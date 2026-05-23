#!/usr/bin/env node
/**
 * 第二轮清洗：改进答案提取，从更多格式中解析答案
 */
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/exercises.json', 'utf8'));

function clean(s) {
  return (s||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\t/g,' ').replace(/  +/g,' ').trim();
}

// Read original data for comparison
const orig = JSON.parse(fs.readFileSync('data/exercises_orig.json', 'utf8'));

// Build a lookup of original questions that might contain answers
const origMap = {};
for (const o of orig) {
  if (o.question && o.question.includes('参考答案')) {
    origMap[o.id] = o.question;
  }
}

let fixed = 0;

for (const item of data) {
  // Skip if already has answer
  if (item.answer) continue;
  
  // Try original text
  const origText = origMap[item.id] || '';
  let answer = '';
  
  // Pattern: 【参考答案】A or 【参考答案】A B D
  let m;
  m = origText.match(/【参考答案】\s*([A-Z\s、，,]+?)(?:\n|$)/);
  if (m) { answer = m[1].trim(); }
  
  if (!answer) {
    m = origText.match(/参考答案[：:]\s*([A-Z\s、，,]+?)(?:\n|$)/);
    if (m) { answer = m[1].trim(); }
  }
  
  // Pattern: answer is inline like "答案A" or "答案是A"
  if (!answer) {
    m = origText.match(/(?:答案|答)[是为：:]\s*([A-Z])/);
    if (m) { answer = m[1]; }
  }
  
  // Pattern: (A) at end of analysis line
  if (!answer) {
    m = origText.match(/(?:正确|答案)[是为：:]\s*?([(（]?[A-Z][)）]?)/);
    if (m) { answer = m[1].replace(/[()（）]/g, ''); }
  }
  
  // Pattern for text answers (not A/B/C/D)
  if (!answer) {
    // Try: 参考答案 followed by Chinese text until newline
    m = origText.match(/【参考答案】\s*\n?\s*([^\n【]{2,}?)(?:\n|$)/);
    if (m && m[1].trim().length > 0 && m[1].trim().length < 500) {
      answer = m[1].trim();
    }
  }
  
  if (!answer) {
    m = origText.match(/参考答案[：:]\s*\n?\s*([^\n【]{2,}?)(?:\n|$)/);
    if (m && m[1].trim().length > 0 && m[1].trim().length < 500) {
      answer = m[1].trim();
    }
  }
  
  if (answer) {
    item.answer = clean(answer);
    fixed++;
    
    // Also extract analysis if missing
    if (!item.analysis) {
      m = origText.match(/【点评】\s*\n([\s\S]+?)$/);
      if (!m) m = origText.match(/【点评】\s*([^\n]+)/);
      if (m) {
        item.analysis = clean(m[1]);
        // Remove reference page info
        item.analysis = item.analysis.replace(/[（(].*?教程.*?[）)]/g, '').replace(/P\d+/g, '').trim();
      }
    }
  }
}

console.log(`Fixed ${fixed} items with newly extracted answers`);
const totalWithAnswer = data.filter(e => e.answer).length;
const goodWithAnswer = data.filter(e => e.quality==='good' && e.answer).length;
const choiceWithAnswer = data.filter(e => (e.type==='choice'||e.type==='multi-choice') && e.answer).length;
const goodChoiceWithAnswer = data.filter(e => e.quality==='good' && (e.type==='choice'||e.type==='multi-choice') && e.answer).length;
console.log(`Total with answer: ${totalWithAnswer}`);
console.log(`Good with answer: ${goodWithAnswer}`);
console.log(`Choice with answer: ${choiceWithAnswer}`);
console.log(`Good choice with answer: ${goodChoiceWithAnswer}`);

fs.writeFileSync('data/exercises.json', JSON.stringify(data, null, 0), 'utf8');
