
global.document = { scripts: [], addEventListener() {} };
global.window = { location: { href: "http://localhost/" } };
const app = require("./script.js");
const fs = require("fs");
const sample = fs.readFileSync("./sample_exam_extracted.txt", "utf8");
const parsed = app.parseExamText(sample);
console.log("sample", JSON.stringify({
  total: parsed.totalBlocks,
  valid: parsed.questions.length,
  errors: parsed.errors,
  types: parsed.questions.map(q => q.type),
  mcqAnswers: parsed.questions.filter(q=>q.type==="multiple_choice").map(q=>q.answer),
  tfAnswers: parsed.questions.find(q=>q.type==="true_false")?.items.map(x=>x.answer)
}));
const missingKey = app.parseExamText("Câu 1: Chọn đúng.\nA. Một\nB. Hai\nC. Ba\nD. Bốn");
console.log("missingKey", JSON.stringify({valid:missingKey.questions.length, errors:missingKey.errors}));
const incomplete = app.parseExamText("Câu 1: Đánh giá các ý sau.\na) Ý a (Đúng)\nb) Ý b (Sai)\nc) Ý c (Đúng)");
console.log("incomplete", JSON.stringify({valid:incomplete.questions.length, errors:incomplete.errors}));
const xss = app.parseExamText("Câu 1: <img src=x onerror=alert(1)>?\nA. <script>alert(1)</script>\nB. Hai\nC. Ba\nD. Bốn\nĐáp án: B");
console.log("xss", JSON.stringify({valid:xss.questions.length, question:xss.questions[0]?.question, optionA:xss.questions[0]?.options[0]}));
const score = [0,1,2,3,4].map(n => {
  const items=[{answer:true},{answer:true},{answer:true},{answer:true}];
  const answers=items.map((_,i)=>i<n ? true : false);
  return app.calculateTrueFalseScore(answers,items);
});
console.log("scores", JSON.stringify(score));
