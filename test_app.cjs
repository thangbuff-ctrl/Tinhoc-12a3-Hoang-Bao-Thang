
global.document = { scripts: [], addEventListener() {} };
global.window = { location: { href: "http://localhost/" } };
const app = require("./script.js");
const fs = require("fs");
const bank = JSON.parse(fs.readFileSync("./questions.json", "utf8"));
const validation = app.validateQuestionBank(bank);
console.log("bank", JSON.stringify({
  count: bank.length,
  mcq: bank.filter(q=>q.type==="multiple_choice").length,
  tf: bank.filter(q=>q.type==="true_false").length,
  valid: validation.valid,
  errors: validation.errors
}));
const allCorrect = {};
for (const q of bank) {
  allCorrect[String(q.id)] = q.type === "multiple_choice"
    ? q.answer
    : q.items.map(item => item.answer);
}
const allCorrectResult = app.calculateExamResult(bank, allCorrect);
console.log("allCorrect", JSON.stringify(allCorrectResult));
const allWrong = {};
for (const q of bank) {
  allWrong[String(q.id)] = q.type === "multiple_choice"
    ? (q.answer + 1) % 4
    : q.items.map(item => !item.answer);
}
console.log("allWrong", JSON.stringify(app.calculateExamResult(bank, allWrong)));
const sample = fs.readFileSync("./sample_exam_extracted.txt", "utf8");
const parsed = app.parseExamText(sample);
console.log("sample", JSON.stringify({
  total: parsed.totalBlocks, valid: parsed.questions.length,
  types: parsed.questions.map(q=>q.type),
  mcqAnswers: parsed.questions.filter(q=>q.type==="multiple_choice").map(q=>q.answer),
  tfAnswers: parsed.questions.find(q=>q.type==="true_false")?.items.map(x=>x.answer),
  errors: parsed.errors
}));
const inline = app.parseExamText("Câu 1: Chọn câu đúng. A. Một B. Hai C. Ba D. Bốn\nĐáp án: C");
console.log("inline", JSON.stringify({valid:inline.questions.length, errors:inline.errors, answer:inline.questions[0]?.answer}));
const tfKey = app.parseExamText("Câu 1: Xét các nhận định đúng sai.\na) Phát biểu một\nb) Phát biểu hai\nc) Phát biểu ba\nd) Phát biểu bốn\nĐáp án: a - Đ, b - S, c - Đ, d - S\nLời giải: Đã đối chiếu.");
console.log("tfKey", JSON.stringify({valid:tfKey.questions.length, answers:tfKey.questions[0]?.items.map(x=>x.answer), errors:tfKey.errors}));
const missingKey = app.parseExamText("Câu 1: Chọn đúng.\nA. Một\nB. Hai\nC. Ba\nD. Bốn");
console.log("missingKey", JSON.stringify({valid:missingKey.questions.length, errors:missingKey.errors}));
const incomplete = app.parseExamText("Câu 1: Đánh giá các ý sau.\na) Ý a (Đúng)\nb) Ý b (Sai)\nc) Ý c (Đúng)");
console.log("incomplete", JSON.stringify({valid:incomplete.questions.length, errors:incomplete.errors}));
const xss = app.parseExamText("Câu 1: <img src=x onerror=alert(1)>?\nA. <script>alert(1)</script>\nB. Hai\nC. Ba\nD. Bốn\nĐáp án: B");
console.log("xss", JSON.stringify({valid:xss.questions.length, question:xss.questions[0]?.question, optionA:xss.questions[0]?.options[0]}));
const tfScores = [0,1,2,3,4].map(n => {
  const items=[{answer:true},{answer:true},{answer:true},{answer:true}];
  const answers=items.map((_,i)=>i<n);
  return app.calculateTrueFalseScore(answers,items);
});
console.log("tfScores", JSON.stringify(tfScores));
