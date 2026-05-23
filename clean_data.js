#!/usr/bin/env node
/**
 * 最终版清洗 - 保守策略：
 * 1. 完整结构化题（有 options + answer + analysis）-> 直接用
 * 2. 有 options + answer 但无 analysis -> 用
 * 3. 有 options 无 answer -> 尝试从 question 文本提取
 * 4. 纯文本（知识点摘录）-> 保留但标记为 text 类型
 * 5. OCR 垃圾 -> 丢弃
 */
const fs = require('fs');

const exercisesRaw = JSON.parse(fs.readFileSync('data/exercises_orig.json', 'utf8'));
const casesRaw = JSON.parse(fs.readFileSync('data/cases_orig.json', 'utf8'));

function clean(s) {
  return (s||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\t/g,' ').replace(/  +/g,' ').trim();
}

function isTrash(text) {
  return /[ee吕]/.test(text);
}

function tryExtractAnswer(text) {
  const patterns = [
    /(?:正确答案|答案)[是为：:]\s*([A-Z]+)/,
    /参考答案[：:]\s*([A-Z]+)/,
    /【参考答案】\s*([A-Z]+)/,
    /[（(]\s*([A-Z])\s*[）)]/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return '';
}

function tryExtractAnalysis(text) {
  const m = text.match(/【点评】\s*\n?([\s\S]+?)$/);
  if (m) return clean(m[1]).replace(/[（(].*?教程.*?[）)]/g, '').replace(/P\d+/g, '').trim();
  return '';
}

function parseInlineOptions(text) {
  const opts = [];
  // Strategy: find option section
  // Pattern: "A、xxx B、xxx C、xxx D、xxx" on same line
  // Or: A、xxx\nB、xxx\nC、xxx\nD、xxx
  
  const lines = text.split('\n');
  let optLines = [];
  let optStartLine = -1;
  
  // Find option block: scan backwards from end
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 12); i--) {
    const trimmed = lines[i].trim();
    if (/^[A-Z][、．.]\s*.{2,}/.test(trimmed)) {
      optStartLine = i;
    } else if (optStartLine >= 0) {
      break; // We found the end of option block
    }
  }
  
  if (optStartLine >= 0) {
    optLines = lines.slice(optStartLine);
    for (const line of optLines) {
      // Each line might have multiple options or one
      // Single option per line: "A、xxx"
      let m = line.trim().match(/^([A-Z])[、．.]\s*(.+)/);
      if (m) {
        opts.push({ label: m[1], text: clean(m[2]) });
        continue;
      }
      // Multiple options per line: "A、xxx B、xxx"
      const parts = line.trim().split(/(?=[A-Z][、．.])/);
      for (const part of parts) {
        m = part.trim().match(/^([A-Z])[、．.]\s*(.+)/);
        if (m && m[2].trim().length > 1) {
          opts.push({ label: m[1], text: clean(m[2]) });
        }
      }
    }
  }
  
  // Validate
  if (opts.length >= 2) {
    // Check sequential
    const labels = opts.map(o => o.label);
    const expected = 'ABCDEFGH'.substring(0, labels.length).split('');
    if (!labels.every((l, i) => l === expected[i])) {
      opts.sort((a, b) => a.label.localeCompare(b.label));
      const sortedLabels = opts.map(o => o.label);
      if (!sortedLabels.every((l, i) => l === expected[i])) return { options: [], optStartLine: -1 };
    }
    return { options: opts, optStartLine };
  }
  
  return { options: [], optStartLine: -1 };
}

// ========== Process ==========
const result = [];
const cases = [];
const stats = { total: exercisesRaw.length, kept: 0, dropped: 0 };

for (const e of exercisesRaw) {
  if (!e.question || e.question.trim().length < 15) { stats.dropped++; continue; }
  if (isTrash(e.question)) { stats.dropped++; continue; }
  
  let question = e.question;
  let options = (e.options && e.options.length >= 2) ? e.options : [];
  let answer = e.answer ? String(e.answer).trim() : '';
  let analysis = e.analysis ? String(e.analysis).trim() : '';
  
  // If no structured answer, try extracting from text
  if (!answer) {
    answer = tryExtractAnswer(question);
  }
  
  // If no structured analysis, try extracting
  if (!analysis) {
    analysis = tryExtractAnalysis(question);
  }
  
  // If no structured options, try parsing from text
  if (options.length < 2) {
    const { options: parsedOpts, optStartLine } = parseInlineOptions(question);
    if (parsedOpts.length >= 2) {
      options = parsedOpts;
      // Remove option text from question
      if (optStartLine >= 0) {
        question = question.split('\n').slice(0, optStartLine).join('\n');
      }
    }
  }
  
  // Remove answer/analysis markers from question display text
  let displayQuestion = question;
  if (displayQuestion.includes('参考答案') || displayQuestion.includes('点评')) {
    displayQuestion = displayQuestion
      .replace(/【参考答案及解析】[\s\S]*/g, '')
      .replace(/【参考答案】\s*\n?[\s\S]*/g, '')
      .replace(/参考答案[：:]\s*\n?[\s\S]*/g, '')
      .replace(/【和参考答案】[\s\S]*/g, '')
      .replace(/【点评】\s*\n?[\s\S]*/g, '')
      .replace(/点评[：:]\s*\n?[\s\S]*/g, '')
      .trim();
  }
  
  displayQuestion = clean(displayQuestion);
  if (displayQuestion.length < 10) { stats.dropped++; continue; }
  
  // Type
  let type = 'text';
  if (options.length >= 2) {
    type = /多选|多项/.test(displayQuestion) ? 'multi-choice' : 'choice';
  } else if (/判断|√|×|是否正确|是否错误/.test(displayQuestion)) {
    type = 'judge';
  }
  
  result.push({
    id: e.id,
    type,
    source: clean(e.source),
    category: clean(e.category),
    chapter: clean(e.chapter),
    time_label: e.time_label || '',
    question_number: e.question_number || null,
    question: displayQuestion,
    options: options.length >= 2 ? options : undefined,
    answer: answer || undefined,
    analysis: analysis || undefined,
  });
  stats.kept++;
}

// Cases
for (const c of casesRaw) {
  if (!c.content || c.content.trim().length < 30) continue;
  if (isTrash(c.content)) continue;
  cases.push({
    id: c.id,
    type: 'case-study',
    source: clean(c.source),
    category: clean(c.category),
    time_label: c.time_label || '',
    title: clean(c.title),
    content: clean(c.content),
  });
}

// Stats
console.log(`Exercises: ${stats.total} -> ${stats.kept} kept, ${stats.dropped} dropped`);
console.log(`Cases: ${cases.length}`);

const byType = {};
result.forEach(e => { byType[e.type] = (byType[e.type]||0)+1; });
console.log('By type:', JSON.stringify(byType));

const withOpts = result.filter(e => e.options).length;
const withAns = result.filter(e => e.answer).length;
const choiceWithAns = result.filter(e => (e.type==='choice'||e.type==='multi-choice') && e.answer).length;
const choiceWithOpts = result.filter(e => e.type==='choice'||e.type==='multi-choice').length;
console.log('Choice/Multi:', choiceWithOpts, 'with answer:', choiceWithAns);
console.log('With options:', withOpts, 'With answer:', withAns);

// Save
fs.writeFileSync('data/exercises.json', JSON.stringify(result, null, 0), 'utf8');
fs.writeFileSync('data/cases.json', JSON.stringify(cases, null, 0), 'utf8');

// Samples
console.log('\n=== CHOICE WITH ANSWER ===');
result.filter(e => e.type==='choice' && e.answer).slice(0, 10).forEach(s => {
  console.log(`\n${s.id} [${s.time_label}]`);
  console.log('Q:', s.question.substring(0, 180));
  console.log('Opts:', s.options.map(o => `${o.label}.${o.text.substring(0,25)}`).join(' | '));
  console.log('Ans:', s.answer);
});

console.log('\n=== CHOICE NO ANSWER (sample) ===');
result.filter(e => e.type==='choice' && !e.answer).slice(0, 5).forEach(s => {
  console.log(`\n${s.id}`);
  console.log('Q:', s.question.substring(0, 180));
  console.log('Opts:', s.options.map(o => `${o.label}.${o.text.substring(0,20)}`).join(' | '));
});
