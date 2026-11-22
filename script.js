/* Tin học 12 PWA – JavaScript thuần, schema tương thích với Starter Kit */
"use strict";

const STORAGE_KEYS = {
  exam: "tin12_custom_exam",
  title: "tin12_custom_exam_title"
};
const MAX_DOCX_BYTES = 12 * 1024 * 1024;
const APP_SCRIPT = Array.from(document.scripts).find((s) => /(?:^|\/)script\.js(?:\?|$)/.test(s.src));
const APP_BASE_URL = new URL(".", APP_SCRIPT ? APP_SCRIPT.src : window.location.href);

let defaultQuestions = [];
let questions = [];
let currentIndex = 0;
let userAnswers = {};
let totalScore = 0;
let isAnswerSubmitted = false;
let activeImportTab = "docx";
let loadedDocxText = "";
let currentExamTitle = "Ngân hàng mặc định";
let currentExamIsCustom = false;
let pendingImport = null;

document.addEventListener("DOMContentLoaded", async () => {
  initNetworkStatusListener();
  setupModalEvents();
  registerServiceWorker();
  await initExamData();
});

function cloneQuestionBank(bank) {
  return JSON.parse(JSON.stringify(bank));
}

function validateQuestionBank(data) {
  const errors = [];
  if (!Array.isArray(data) || data.length === 0) {
    return { valid: false, errors: ["Ngân hàng câu hỏi phải là một mảng không rỗng."] };
  }

  const seenIds = new Set();
  data.forEach((q, index) => {
    const label = `Câu ${index + 1}`;
    if (!q || typeof q !== "object" || Array.isArray(q)) {
      errors.push(`${label}: dữ liệu câu hỏi không phải object.`);
      return;
    }

    if (q.id === undefined || q.id === null || String(q.id).trim() === "") {
      errors.push(`${label}: thiếu ID.`);
    } else {
      const id = String(q.id);
      if (seenIds.has(id)) errors.push(`${label}: ID "${id}" bị trùng.`);
      seenIds.add(id);
    }

    if (!["multiple_choice", "true_false"].includes(q.type)) {
      errors.push(`${label}: type phải là "multiple_choice" hoặc "true_false".`);
    }
    if (typeof q.topic !== "string" || !q.topic.trim()) {
      errors.push(`${label}: thiếu topic.`);
    }
    if (typeof q.question !== "string" || !q.question.trim()) {
      errors.push(`${label}: thiếu nội dung câu hỏi.`);
    }
    if (typeof q.explanation !== "string" || !q.explanation.trim()) {
      errors.push(`${label}: thiếu explanation.`);
    }

    if (q.type === "multiple_choice") {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(`${label}: câu multiple_choice phải có đúng 4 phương án.`);
      } else if (q.options.some((option) => typeof option !== "string" || !option.trim())) {
        errors.push(`${label}: có phương án trống hoặc không phải chuỗi.`);
      }
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) {
        errors.push(`${label}: answer phải là số nguyên từ 0 đến 3.`);
      }
    }

    if (q.type === "true_false") {
      if (!Array.isArray(q.items) || q.items.length !== 4) {
        errors.push(`${label}: câu true_false phải có đúng 4 nhận định.`);
      } else {
        const labels = q.items.map((item) => item && item.label);
        if (JSON.stringify(labels) !== JSON.stringify(["a", "b", "c", "d"])) {
          errors.push(`${label}: nhãn nhận định phải lần lượt là a, b, c, d.`);
        }
        q.items.forEach((item, itemIndex) => {
          if (!item || typeof item.statement !== "string" || !item.statement.trim()) {
            errors.push(`${label}: nhận định ${"abcd"[itemIndex]} bị thiếu nội dung.`);
          }
          if (!item || typeof item.answer !== "boolean") {
            errors.push(`${label}: đáp án nhận định ${"abcd"[itemIndex]} phải là true/false.`);
          }
        });
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

function initNetworkStatusListener() {
  const badge = document.getElementById("connection-badge");
  const updateStatus = () => {
    const online = navigator.onLine;
    badge.textContent = online ? "Trực tuyến" : "Ngoại tuyến";
    badge.className = online ? "badge-online" : "badge-offline";
    badge.setAttribute("aria-label", online ? "Đang có kết nối Internet" : "Đang ngoại tuyến");
  };
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);
  updateStatus();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const workerUrl = new URL("sw.js", APP_BASE_URL);
  navigator.serviceWorker.register(workerUrl.href, { scope: APP_BASE_URL.pathname })
    .then((registration) => console.info("Service Worker đã đăng ký:", registration.scope))
    .catch((error) => console.warn("Không thể đăng ký Service Worker:", error));
}

async function loadDefaultQuestionBank() {
  const response = await fetch(new URL("questions.json", APP_BASE_URL).href);
  if (!response.ok) throw new Error(`Không tải được questions.json (HTTP ${response.status}).`);
  const data = await response.json();
  const validation = validateQuestionBank(data);
  if (!validation.valid) {
    throw new Error(`questions.json không hợp lệ:\n${validation.errors.join("\n")}`);
  }
  return data;
}

function safeLocalStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("Không thể đọc localStorage:", error);
    return null;
  }
}

async function initExamData() {
  const questionText = document.getElementById("question-text");
  questionText.textContent = "Đang nạp ngân hàng câu hỏi...";

  try {
    defaultQuestions = await loadDefaultQuestionBank();
    const savedExam = safeLocalStorageGet(STORAGE_KEYS.exam);
    const savedTitle = safeLocalStorageGet(STORAGE_KEYS.title);

    if (savedExam) {
      try {
        const parsed = JSON.parse(savedExam);
        const validation = validateQuestionBank(parsed);
        if (!validation.valid) throw new Error(validation.errors.join(" "));
        questions = cloneQuestionBank(parsed);
        currentExamTitle = savedTitle || `Đề đã nạp (${questions.length} câu)`;
        currentExamIsCustom = true;
      } catch (error) {
        console.warn("Đề tùy chỉnh lưu trên máy không hợp lệ; dùng ngân hàng mặc định.", error);
        questions = cloneQuestionBank(defaultQuestions);
        currentExamTitle = `Ngân hàng mặc định (${questions.length} câu)`;
        currentExamIsCustom = false;
      }
    } else {
      questions = cloneQuestionBank(defaultQuestions);
      currentExamTitle = `Ngân hàng mặc định (${questions.length} câu)`;
      currentExamIsCustom = false;
    }

    updateExamStatusBar();
    restartQuiz();
  } catch (error) {
    console.error(error);
    questionText.textContent = "Không thể tải ngân hàng câu hỏi. Hãy kiểm tra questions.json và chạy ứng dụng qua HTTPS hoặc máy chủ web.";
    document.getElementById("exam-source-title").textContent = "Đề thi: Chưa tải được dữ liệu";
  }
}

function updateExamStatusBar() {
  document.getElementById("exam-source-title").textContent = `Đề thi: ${currentExamTitle}`;
  document.getElementById("btn-reset-default").classList.toggle("hidden", !currentExamIsCustom);
}

function resetToDefaultExam() {
  if (!confirm("Bạn có muốn xóa đề đã nạp và quay lại ngân hàng mặc định không?")) return;

  try {
    localStorage.removeItem(STORAGE_KEYS.exam);
    localStorage.removeItem(STORAGE_KEYS.title);
  } catch (error) {
    alert("Không thể xóa đề tùy chỉnh khỏi bộ nhớ trình duyệt. Vui lòng kiểm tra quyền lưu trữ.");
    return;
  }

  questions = cloneQuestionBank(defaultQuestions);
  currentExamTitle = `Ngân hàng mặc định (${questions.length} câu)`;
  currentExamIsCustom = false;
  updateExamStatusBar();
  restartQuiz();
}

function questionKey(q) {
  return String(q.id);
}

function renderQuestion(index) {
  if (!Array.isArray(questions) || questions.length === 0) return;
  if (index < 0 || index >= questions.length) return;

  isAnswerSubmitted = false;
  const q = questions[index];
  const container = document.getElementById("options-container");
  const explanationBox = document.getElementById("explanation-box");

  document.getElementById("progress-text").textContent = `Câu ${index + 1} / ${questions.length}`;
  document.getElementById("progress-bar-fill").style.width = `${((index + 1) / questions.length) * 100}%`;
  document.getElementById("progress-bar-fill").setAttribute("aria-valuenow", String(index + 1));
  document.getElementById("progress-bar-fill").setAttribute("aria-valuemax", String(questions.length));
  document.getElementById("question-topic").textContent = q.topic;
  document.getElementById("question-text").textContent = q.question;
  document.getElementById("current-score-text").textContent = `Điểm: ${totalScore.toFixed(2)}`;

  explanationBox.classList.add("hidden");
  document.getElementById("btn-submit").classList.remove("hidden");
  document.getElementById("btn-next").classList.add("hidden");
  container.replaceChildren();

  if (q.type === "true_false") {
    document.getElementById("question-type-badge").textContent = "Đúng / Sai";
    renderTrueFalseOptions(q, container);
  } else {
    document.getElementById("question-type-badge").textContent = "Trắc nghiệm";
    renderMultipleChoiceOptions(q, container);
  }
}

function renderMultipleChoiceOptions(q, container) {
  const selected = userAnswers[questionKey(q)];
  q.options.forEach((optionText, optionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-option";
    button.textContent = `${String.fromCharCode(65 + optionIndex)}. ${optionText}`;
    button.setAttribute("aria-pressed", String(selected === optionIndex));
    if (selected === optionIndex) button.classList.add("selected");

    button.addEventListener("click", () => {
      if (isAnswerSubmitted) return;
      userAnswers[questionKey(q)] = optionIndex;
      container.querySelectorAll(".btn-option").forEach((item) => {
        item.classList.remove("selected");
        item.setAttribute("aria-pressed", "false");
      });
      button.classList.add("selected");
      button.setAttribute("aria-pressed", "true");
    });
    container.appendChild(button);
  });
}

function renderTrueFalseOptions(q, container) {
  const key = questionKey(q);
  if (!Array.isArray(userAnswers[key])) userAnswers[key] = [null, null, null, null];

  const group = document.createElement("div");
  group.className = "tf-group";

  q.items.forEach((item, itemIndex) => {
    const card = document.createElement("div");
    card.className = "tf-item-card";

    const statement = document.createElement("p");
    statement.className = "tf-statement";
    const label = document.createElement("strong");
    label.textContent = `${item.label}) `;
    statement.append(label, document.createTextNode(item.statement));
    card.appendChild(statement);

    const buttonGroup = document.createElement("div");
    buttonGroup.className = "tf-btn-group";

    const trueButton = document.createElement("button");
    trueButton.type = "button";
    trueButton.className = "btn-tf";
    trueButton.textContent = "Đúng";
    trueButton.setAttribute("aria-pressed", String(userAnswers[key][itemIndex] === true));

    const falseButton = document.createElement("button");
    falseButton.type = "button";
    falseButton.className = "btn-tf";
    falseButton.textContent = "Sai";
    falseButton.setAttribute("aria-pressed", String(userAnswers[key][itemIndex] === false));

    if (userAnswers[key][itemIndex] === true) trueButton.classList.add("active-true");
    if (userAnswers[key][itemIndex] === false) falseButton.classList.add("active-false");

    trueButton.addEventListener("click", () => {
      if (isAnswerSubmitted) return;
      userAnswers[key][itemIndex] = true;
      trueButton.classList.add("active-true");
      falseButton.classList.remove("active-false");
      trueButton.setAttribute("aria-pressed", "true");
      falseButton.setAttribute("aria-pressed", "false");
    });

    falseButton.addEventListener("click", () => {
      if (isAnswerSubmitted) return;
      userAnswers[key][itemIndex] = false;
      falseButton.classList.add("active-false");
      trueButton.classList.remove("active-true");
      falseButton.setAttribute("aria-pressed", "true");
      trueButton.setAttribute("aria-pressed", "false");
    });

    buttonGroup.append(trueButton, falseButton);
    card.append(statement, buttonGroup);
    group.appendChild(card);
  });

  container.appendChild(group);
}

function calculateTrueFalseScore(userChoices, items) {
  const correctCount = items.reduce((count, item, index) => {
    return count + (userChoices[index] === item.answer ? 1 : 0);
  }, 0);
  const scoreByCount = [0, 0.1, 0.25, 0.5, 1.0];
  return scoreByCount[correctCount];
}

function getQuestionMaxScore(q) {
  return q.type === "true_false" ? 1.0 : 0.25;
}

function handleSubmitAnswer() {
  if (isAnswerSubmitted) return;
  const q = questions[currentIndex];
  if (!q) return;
  const answer = userAnswers[questionKey(q)];

  if (q.type === "true_false") {
    if (!Array.isArray(answer) || answer.length !== 4 || answer.some((value) => value === null)) {
      alert("Vui lòng trả lời đủ 4 nhận định a, b, c, d.");
      return;
    }
  } else if (!Number.isInteger(answer)) {
    alert("Vui lòng chọn một đáp án.");
    return;
  }

  isAnswerSubmitted = true;
  document.getElementById("btn-submit").classList.add("hidden");
  document.getElementById("btn-next").classList.remove("hidden");

  const earnedScore = q.type === "true_false"
    ? gradeTrueFalse(q, answer)
    : gradeMultipleChoice(q, answer);
  totalScore += earnedScore;
  document.getElementById("current-score-text").textContent = `Điểm: ${totalScore.toFixed(2)}`;

  const answerSummary = q.type === "true_false"
    ? `Đáp án: ${q.items.map((item) => `${item.label.toUpperCase()} – ${item.answer ? "Đúng" : "Sai"}`).join("; ")}.`
    : `Đáp án đúng: ${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`;

  document.getElementById("explanation-text").textContent = `${answerSummary}\n${q.explanation}`;
  document.getElementById("explanation-box").classList.remove("hidden");
}

function gradeMultipleChoice(q, userChoice) {
  const buttons = document.querySelectorAll(".btn-option");
  buttons.forEach((button, index) => {
    if (index === q.answer) button.classList.add("correct");
    else if (index === userChoice) button.classList.add("wrong");
    button.disabled = true;
  });
  return userChoice === q.answer ? 0.25 : 0;
}

function gradeTrueFalse(q, userChoices) {
  const cards = document.querySelectorAll(".tf-item-card");
  q.items.forEach((item, index) => {
    const buttons = cards[index].querySelectorAll(".btn-tf");
    const [trueButton, falseButton] = buttons;
    if (item.answer) {
      trueButton.classList.add("is-correct");
      if (userChoices[index] === false) falseButton.classList.add("is-wrong");
    } else {
      falseButton.classList.add("is-correct");
      if (userChoices[index] === true) trueButton.classList.add("is-wrong");
    }
    trueButton.disabled = true;
    falseButton.disabled = true;
  });
  return calculateTrueFalseScore(userChoices, q.items);
}

function handleNextQuestion() {
  if (!isAnswerSubmitted) return;
  if (currentIndex < questions.length - 1) {
    currentIndex += 1;
    renderQuestion(currentIndex);
  } else {
    showFinalResults();
  }
}

function calculateExamResult(bank, answers) {
  let earned = 0;
  let maximum = 0;
  let fullyCorrect = 0;

  bank.forEach((q) => {
    maximum += getQuestionMaxScore(q);
    const answer = answers[questionKey(q)];
    if (q.type === "multiple_choice") {
      if (answer === q.answer) {
        earned += 0.25;
        fullyCorrect += 1;
      }
    } else if (Array.isArray(answer) && answer.length === 4) {
      const correctCount = q.items.reduce((count, item, index) => {
        return count + (answer[index] === item.answer ? 1 : 0);
      }, 0);
      earned += calculateTrueFalseScore(answer, q.items);
      if (correctCount === 4) fullyCorrect += 1;
    }
  });

  const score10 = maximum > 0 ? (earned / maximum) * 10 : 0;
  return {
    earned,
    maximum,
    score10,
    percent: maximum > 0 ? (earned / maximum) * 100 : 0,
    correctQuestions: fullyCorrect,
    incorrectQuestions: bank.length - fullyCorrect
  };
}

function showFinalResults() {
  document.getElementById("quiz-card").classList.add("hidden");
  document.getElementById("quiz-footer").classList.add("hidden");
  document.getElementById("result-screen").classList.remove("hidden");

  const result = calculateExamResult(questions, userAnswers);
  document.getElementById("final-score").textContent = result.score10.toFixed(1);
  document.getElementById("stat-percent").textContent = `${Math.round(result.percent)}%`;
  document.getElementById("stat-total-q").textContent = String(questions.length);
  document.getElementById("stat-correct").textContent = String(result.correctQuestions);
  document.getElementById("stat-incorrect").textContent = String(result.incorrectQuestions);

  const evaluation = result.score10 >= 9 ? "Xuất sắc!"
    : result.score10 >= 8 ? "Rất tốt!"
    : result.score10 >= 6.5 ? "Khá tốt!"
    : result.score10 >= 5 ? "Đạt yêu cầu – tiếp tục luyện tập!"
    : "Cần ôn tập thêm – hãy thử lại!";
  document.getElementById("result-evaluation").textContent = evaluation;
}

function restartQuiz() {
  currentIndex = 0;
  totalScore = 0;
  userAnswers = {};
  isAnswerSubmitted = false;
  document.getElementById("current-score-text").textContent = "Điểm: 0.00";
  document.getElementById("result-screen").classList.add("hidden");
  document.getElementById("quiz-card").classList.remove("hidden");
  document.getElementById("quiz-footer").classList.remove("hidden");
  if (questions.length > 0) renderQuestion(currentIndex);
}

function restartWithShuffle() {
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  questions = shuffled;
  restartQuiz();
}

function setupModalEvents() {
  document.getElementById("btn-open-import").addEventListener("click", openImportModal);
  document.getElementById("docx-input").addEventListener("change", handleDocxFileSelect);
  document.getElementById("btn-do-import").addEventListener("click", executeImport);
  document.getElementById("btn-fill-default-text").addEventListener("click", fillDefaultExamText);
  document.getElementById("btn-clear-paste-text").addEventListener("click", clearPasteExamText);
  document.getElementById("paste-text-input").addEventListener("input", () => {
    if (pendingImport) {
      pendingImport = null;
      updateImportButton();
      clearImportPreview();
      showImportStatus("Văn bản đã thay đổi. Hãy phân tích lại trước khi xác nhận.", "success");
    }
  });
  const fileDropzone = document.querySelector(".file-dropzone");
  fileDropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.getElementById("docx-input").click();
    }
  });
  document.getElementById("tab-btn-docx").addEventListener("click", () => switchImportTab("docx"));
  document.getElementById("tab-btn-text").addEventListener("click", () => switchImportTab("text"));
}

async function fillDefaultExamText() {
  const textarea = document.getElementById("paste-text-input");
  const button = document.getElementById("btn-fill-default-text");
  const previousLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Đang nạp nội dung...";
  try {
    const response = await fetch(new URL("./Noi_Dung_De_Thi_26_Cau.txt", APP_BASE_URL), {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Không tải được nội dung mẫu (HTTP ${response.status}).`);
    textarea.value = await response.text();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    showImportStatus("Đã chèn 26 câu theo đúng định dạng mẫu. Bấm “Phân tích đề thi” để kiểm tra trước khi nhập.", "success");
  } catch (error) {
    showImportStatus(`Không thể chèn bộ câu hỏi mẫu: ${error.message}. Bạn có thể tải file TXT và sao chép nội dung thủ công.`, "error");
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
}

function clearPasteExamText() {
  const textarea = document.getElementById("paste-text-input");
  textarea.value = "";
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
  pendingImport = null;
  updateImportButton();
  clearImportPreview();
  clearImportStatus();
}

function openImportModal() {
  document.getElementById("import-modal").classList.remove("hidden");
  clearImportStatus();
  clearImportPreview();
}

function closeImportModal() {
  document.getElementById("import-modal").classList.add("hidden");
  pendingImport = null;
  updateImportButton();
}

function switchImportTab(tab) {
  activeImportTab = tab;
  pendingImport = null;
  updateImportButton();
  document.getElementById("tab-btn-docx").classList.toggle("active", tab === "docx");
  document.getElementById("tab-btn-text").classList.toggle("active", tab === "text");
  document.getElementById("tab-btn-docx").setAttribute("aria-selected", String(tab === "docx"));
  document.getElementById("tab-btn-text").setAttribute("aria-selected", String(tab === "text"));
  document.getElementById("tab-content-docx").classList.toggle("hidden", tab !== "docx");
  document.getElementById("tab-content-text").classList.toggle("hidden", tab !== "text");
  clearImportStatus();
  clearImportPreview();
}

function updateImportButton() {
  document.getElementById("btn-do-import").textContent = pendingImport
    ? "Xác nhận & Bắt đầu làm bài"
    : "Phân tích đề thi";
}

function clearImportStatus() {
  const box = document.getElementById("import-msg");
  box.className = "import-msg hidden";
  box.textContent = "";
}

function clearImportPreview() {
  const box = document.getElementById("import-preview");
  box.classList.add("hidden");
  box.replaceChildren();
}

function showImportStatus(message, type) {
  const box = document.getElementById("import-msg");
  box.textContent = message;
  box.className = `import-msg ${type}`;
}

function showImportPreview(result) {
  const box = document.getElementById("import-preview");
  box.replaceChildren();
  box.classList.remove("hidden");

  const summary = document.createElement("p");
  summary.className = "preview-summary";
  summary.textContent = `Tìm thấy ${result.totalBlocks} câu • Hợp lệ: ${result.questions.length} • ABCD: ${result.multipleChoiceCount} • Đúng/Sai: ${result.trueFalseCount} • Lỗi: ${result.errors.length}`;
  box.appendChild(summary);

  if (result.errors.length > 0) {
    const heading = document.createElement("strong");
    heading.textContent = "Các câu cần sửa trước khi nhập:";
    box.appendChild(heading);
    const list = document.createElement("ul");
    result.errors.forEach((error) => {
      const item = document.createElement("li");
      item.textContent = `Câu ${error.number}: ${error.message}`;
      list.appendChild(item);
    });
    box.appendChild(list);
  } else {
    const heading = document.createElement("strong");
    heading.textContent = "Xem trước:";
    box.appendChild(heading);
    const list = document.createElement("ol");
    result.questions.slice(0, 4).forEach((q) => {
      const item = document.createElement("li");
      item.textContent = `${q.type === "true_false" ? "[Đúng/Sai]" : "[ABCD]"} ${q.question}`;
      list.appendChild(item);
    });
    if (result.questions.length > 4) {
      const more = document.createElement("li");
      more.textContent = `... và ${result.questions.length - 4} câu khác.`;
      list.appendChild(more);
    }
    box.appendChild(list);
  }
}

async function handleDocxFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  loadedDocxText = "";
  pendingImport = null;
  updateImportButton();
  clearImportPreview();

  if (!file) return;
  event.target.value = "";
  document.getElementById("docx-filename-text").textContent = file.name;
  document.getElementById("docx-filename-badge").classList.remove("hidden");

  if (!/\.docx$/i.test(file.name)) {
    showImportStatus("Chỉ hỗ trợ tệp Word .docx.", "error");
    return;
  }
  if (file.size > MAX_DOCX_BYTES) {
    showImportStatus("Tệp vượt quá giới hạn 12 MB. Vui lòng chọn tệp nhỏ hơn.", "error");
    return;
  }

  showImportStatus("Đang đọc tệp Word trực tiếp trên thiết bị...", "success");
  try {
    const buffer = await file.arrayBuffer();
    loadedDocxText = await extractDocxText(buffer);
    if (!loadedDocxText.trim()) throw new Error("Không tìm thấy văn bản trong tài liệu.");
    showImportStatus(`Đã trích xuất văn bản từ "${file.name}". Hãy chọn Phân tích đề thi để xem trước.`, "success");
  } catch (error) {
    console.error(error);
    loadedDocxText = "";
    showImportStatus(`Không đọc được tệp Word: ${error.message}`, "error");
  }
}

async function extractDocxText(arrayBuffer) {
  const xmlText = await extractDocxDocumentXml(arrayBuffer);
  if (!xmlText) throw new Error("Không tìm thấy word/document.xml trong gói DOCX.");

  const xmlDocument = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xmlDocument.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Tệp DOCX chứa XML không hợp lệ.");
  }

  const wordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const paragraphs = Array.from(xmlDocument.getElementsByTagNameNS(wordNamespace, "p"));

  function readParagraph(paragraph) {
    let output = "";
    function visit(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.namespaceURI === wordNamespace && node.localName === "t") {
        output += node.textContent || "";
        return;
      }
      if (node.namespaceURI === wordNamespace && node.localName === "tab") {
        output += "\t";
        return;
      }
      if (node.namespaceURI === wordNamespace && ["br", "cr"].includes(node.localName)) {
        output += "\n";
        return;
      }
      Array.from(node.childNodes).forEach(visit);
    }
    Array.from(paragraph.childNodes).forEach(visit);
    return output.replace(/\u00a0/g, " ").trim();
  }

  return paragraphs.map(readParagraph).filter((line) => line.length > 0).join("\n");
}

async function extractDocxDocumentXml(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 22) {
    throw new Error("Tệp DOCX rỗng hoặc không hợp lệ.");
  }

  const sig = new Uint8Array(arrayBuffer, 0, 2);
  if (sig[0] !== 0x50 || sig[1] !== 0x4b) {
    throw new Error("Tệp không phải định dạng DOCX chuẩn. Hãy lưu lại bằng Word dưới dạng .docx.");
  }

  if (typeof JSZip === "undefined") {
    throw new Error("Chưa tải được JSZip. Hãy kiểm tra thẻ <script> JSZip trong HTML.");
  }

  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    throw new Error("Không tìm thấy word/document.xml trong gói DOCX.");
  }

  return await docFile.async("string");
}

function normalizeExamText(rawText) {
  return String(rawText)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function splitQuestionBlocks(text) {
  const headingRegex = /(?:^|\n)\s*(?:Câu\s*)?(\d{1,3})\s*[:.)]\s*/gim;
  const headings = [];
  let match;
  while ((match = headingRegex.exec(text)) !== null) {
    const prefixNewline = match[0].startsWith("\n") ? 1 : 0;
    headings.push({
      number: match[1],
      start: match.index + prefixNewline,
      contentStart: match.index + match[0].length
    });
  }

  return headings.map((heading, index) => ({
    number: heading.number,
    text: text.slice(heading.contentStart, index + 1 < headings.length ? headings[index + 1].start : text.length).trim()
  }));
}

function findLabelMarkers(text, labels, caseInsensitive = false) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(^|[\\s])(${escaped})\\s*[.)]\\s*`, caseInsensitive ? "gim" : "gm");
  const markers = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const labelStart = match.index + match[1].length;
    markers.push({
      label: match[2],
      start: labelStart,
      contentStart: match.index + match[0].length
    });
  }
  return markers;
}

function extractExplanation(block) {
  const match = block.match(/(?:^|\n)\s*(?:Giải thích|Lời giải|Hướng dẫn|HD)\s*[:.-]\s*/i);
  if (!match) return { body: block, explanation: "Tài liệu nguồn không cung cấp lời giải." };
  const start = match.index + (match[0].startsWith("\n") ? 1 : 0);
  const contentStart = match.index + match[0].length;
  return {
    body: block.slice(0, start).trim(),
    explanation: block.slice(contentStart).trim() || "Tài liệu nguồn không cung cấp lời giải."
  };
}

function extractAnswerLine(block) {
  const match = block.match(/(?:^|\n)\s*(?:Đáp án|Đ\/A|ĐA|Key)\s*[:.-]\s*([^\n]*)/i);
  if (!match) return { body: block, value: "" };
  const lineStart = match.index + (match[0].startsWith("\n") ? 1 : 0);
  return {
    body: block.slice(0, lineStart).trim() + block.slice(match.index + match[0].length).trimStart(),
    value: match[1].trim()
  };
}

function parseTrueFalseKey(keyText) {
  const answers = {};
  const regex = /([a-d])\s*[-:=]\s*(Đúng|Sai|Đ|S|True|False)/gi;
  let match;
  while ((match = regex.exec(keyText)) !== null) {
    answers[match[1].toLowerCase()] = /^(đúng|đ|true)$/i.test(match[2]);
  }
  return answers;
}

function parseInlineTrueFalseTag(statement) {
  const match = statement.match(/\s*[\(\[]\s*(Đúng|Sai|True|False|Đ|S)\s*[\)\]]\s*$/i);
  if (!match) return null;
  return {
    answer: /^(đúng|đ|true)$/i.test(match[1]),
    statement: statement.slice(0, match.index).trim()
  };
}

function parseQuestionBlock(block, number, id) {
  const explanationResult = extractExplanation(block);
  const answerResult = extractAnswerLine(explanationResult.body);
  let body = answerResult.body.trim();
  const answerKey = answerResult.value;

  const tfMarkers = findLabelMarkers(body, ["a", "b", "c", "d"]);
  const hasTfSignal = /đúng\s+hay\s+sai/i.test(body)
    || /\(\s*(?:Đúng|Sai|True|False|Đ|S)\s*\)/i.test(body)
    || Object.keys(parseTrueFalseKey(answerKey)).length > 0;

  if (hasTfSignal) {
    if (tfMarkers.length !== 4 || tfMarkers.map((m) => m.label.toLowerCase()).join("") !== "abcd") {
      return { error: "Câu Đúng/Sai phải có đủ 4 nhận định theo thứ tự a, b, c, d." };
    }
    const questionText = body.slice(0, tfMarkers[0].start).trim();
    const keyMap = parseTrueFalseKey(answerKey);
    const items = [];
    for (let index = 0; index < 4; index += 1) {
      const marker = tfMarkers[index];
      const end = index === 3 ? body.length : tfMarkers[index + 1].start;
      const rawStatement = body.slice(marker.contentStart, end).trim();
      const inline = parseInlineTrueFalseTag(rawStatement);
      const statement = inline ? inline.statement : rawStatement;
      const answer = inline ? inline.answer : keyMap[marker.label.toLowerCase()];
      if (!statement) {
        return { error: `Nhận định ${marker.label} bị trống.` };
      }
      if (typeof answer !== "boolean") {
        return { error: `Thiếu đáp án Đúng/Sai cho nhận định ${marker.label}.` };
      }
      items.push({ label: marker.label.toLowerCase(), statement, answer });
    }
    if (!questionText) return { error: "Thiếu nội dung dẫn của câu Đúng/Sai." };
    return {
      question: {
        id, type: "true_false", topic: "Tin học 12 – Đề nhập",
        question: questionText, items, explanation: explanationResult.explanation
      }
    };
  }

  const mcqMarkers = findLabelMarkers(body, ["A", "B", "C", "D"]);
  if (mcqMarkers.length !== 4 || mcqMarkers.map((m) => m.label.toUpperCase()).join("") !== "ABCD") {
    return { error: "Câu trắc nghiệm phải có đủ và đúng thứ tự 4 phương án A, B, C, D." };
  }

  const answerMatch = answerKey.match(/^\s*([A-D])(?:\s|[.;,]|$)/i);
  if (!answerMatch) return { error: "Thiếu đáp án trắc nghiệm hợp lệ (ví dụ: Đáp án: B)." };

  const questionText = body.slice(0, mcqMarkers[0].start).trim();
  if (!questionText) return { error: "Thiếu nội dung câu hỏi." };

  const options = mcqMarkers.map((marker, index) => {
    const end = index === 3 ? body.length : mcqMarkers[index + 1].start;
    return body.slice(marker.contentStart, end).trim();
  });
  if (options.some((option) => !option)) return { error: "Có phương án trắc nghiệm bị trống." };

  return {
    question: {
      id, type: "multiple_choice", topic: "Tin học 12 – Đề nhập",
      question: questionText, options,
      answer: answerMatch[1].toUpperCase().charCodeAt(0) - 65,
      explanation: explanationResult.explanation
    }
  };
}

function parseExamText(rawText) {
  const text = normalizeExamText(rawText);
  const blocks = splitQuestionBlocks(text);
  const result = {
    totalBlocks: blocks.length,
    questions: [],
    errors: [],
    multipleChoiceCount: 0,
    trueFalseCount: 0
  };

  if (blocks.length === 0) {
    result.errors.push({ number: "?", message: "Không tìm thấy tiêu đề câu hỏi dạng Câu 1:, Câu 1. hoặc 1." });
    return result;
  }

  blocks.forEach((block, index) => {
    if (!block.text) {
      result.errors.push({ number: block.number, message: "Nội dung câu hỏi trống." });
      return;
    }
    const parsed = parseQuestionBlock(block.text, block.number, index + 1);
    if (parsed.error) {
      result.errors.push({ number: block.number, message: parsed.error });
      return;
    }
    result.questions.push(parsed.question);
  });

  result.multipleChoiceCount = result.questions.filter((q) => q.type === "multiple_choice").length;
  result.trueFalseCount = result.questions.filter((q) => q.type === "true_false").length;
  return result;
}

function executeImport() {
  if (!pendingImport) {
    const textToParse = activeImportTab === "docx"
      ? loadedDocxText
      : document.getElementById("paste-text-input").value;
    if (!textToParse || !textToParse.trim()) {
      showImportStatus("Chưa có nội dung đề thi. Vui lòng chọn tệp .docx hoặc dán văn bản.", "error");
      return;
    }

    const result = parseExamText(textToParse);
    showImportPreview(result);

    if (result.errors.length > 0 || result.questions.length !== result.totalBlocks) {
      pendingImport = null;
      updateImportButton();
      showImportStatus("Đề chưa được nhập. Hãy sửa tất cả câu có lỗi rồi phân tích lại; ngân hàng đang làm bài được giữ nguyên.", "error");
      return;
    }

    const validation = validateQuestionBank(result.questions);
    if (!validation.valid) {
      pendingImport = null;
      updateImportButton();
      showImportStatus(`Dữ liệu phân tích chưa hợp lệ: ${validation.errors.join(" ")}`, "error");
      return;
    }

    pendingImport = {
      questions: result.questions,
      title: activeImportTab === "docx"
        ? `Tệp Word "${document.getElementById("docx-filename-text").textContent}"`
        : "Văn bản sao chép"
    };
    updateImportButton();
    showImportStatus("Phân tích hoàn tất. Kiểm tra phần xem trước, sau đó bấm Xác nhận & Bắt đầu làm bài.", "success");
    return;
  }

  const newQuestions = pendingImport.questions;
  const newTitle = `${pendingImport.title} (${newQuestions.length} câu)`;
  const oldExam = safeLocalStorageGet(STORAGE_KEYS.exam);
  const oldTitle = safeLocalStorageGet(STORAGE_KEYS.title);

  try {
    localStorage.setItem(STORAGE_KEYS.exam, JSON.stringify(newQuestions));
    localStorage.setItem(STORAGE_KEYS.title, newTitle);
  } catch (error) {
    try {
      if (oldExam === null) localStorage.removeItem(STORAGE_KEYS.exam);
      else localStorage.setItem(STORAGE_KEYS.exam, oldExam);
      if (oldTitle === null) localStorage.removeItem(STORAGE_KEYS.title);
      else localStorage.setItem(STORAGE_KEYS.title, oldTitle);
    } catch (rollbackError) {
      console.error("Không thể khôi phục giá trị localStorage cũ:", rollbackError);
    }
    showImportStatus("Không lưu được đề mới vào bộ nhớ trình duyệt. Đề hiện tại chưa bị thay thế.", "error");
    return;
  }

  questions = cloneQuestionBank(newQuestions);
  currentExamTitle = newTitle;
  currentExamIsCustom = true;
  pendingImport = null;
  updateImportButton();
  updateExamStatusBar();
  restartQuiz();
  closeImportModal();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    validateQuestionBank,
    calculateTrueFalseScore,
    calculateExamResult,
    normalizeExamText,
    splitQuestionBlocks,
    parseExamText,
    extractDocxDocumentXml
  };
}
