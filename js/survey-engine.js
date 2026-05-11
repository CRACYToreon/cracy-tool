/**
 * Survey engine: one question at a time. answers state, showIf (JSON-Logic), next/end.
 * questions: array of { id, type, text, options?, showIf? }
 * jsonLogic: (expr, data) => value
 */
export function createEngine(questions, jsonLogic) {
  const answers = {};
  let currentQuestionId = null;

  function getData() {
    return { answers };
  }

  function getApplicableQuestions() {
    const data = getData();
    return questions.filter(
      (q) => q.type !== "message" && (!q.showIf || jsonLogic(q.showIf, data))
    );
  }

  function allApplicableAnswered() {
    const applicable = getApplicableQuestions();
    return applicable.every((q) => {
      const v = answers[q.id];
      if (q.type === "multi") return Array.isArray(v);
      return v !== undefined && v !== "";
    });
  }

  /** Returns all questions that are visible in order (including message when done). */
  function getVisibleQuestions() {
    const data = getData();
    const showMessage = allApplicableAnswered();
    return questions.filter((q) => {
      if (q.type === "message") return showMessage;
      return !q.showIf || jsonLogic(q.showIf, data);
    });
  }

  /** Returns the single question to show right now (one-at-a-time flow). */
  function getQuestionToShow() {
    const visible = getVisibleQuestions();
    if (visible.length === 0) return null;
    if (currentQuestionId === null) {
      currentQuestionId = visible[0].id;
      return visible[0];
    }
    const idx = visible.findIndex((q) => q.id === currentQuestionId);
    if (idx >= 0) return visible[idx];
    currentQuestionId = visible[0].id;
    return visible[0];
  }

  /** Move to the next visible question (used after multi or when no option.next). */
  function advanceToNext() {
    const visible = getVisibleQuestions();
    const idx = visible.findIndex((q) => q.id === currentQuestionId);
    if (idx >= 0 && idx < visible.length - 1) {
      currentQuestionId = visible[idx + 1].id;
      return visible[idx + 1];
    }
    currentQuestionId = null;
    return null;
  }

  /**
   * Apply an answer. option is the chosen option object (for single) or null (multi handled separately).
   * Returns { ended, finalMessage, nextId }.
   */
  function applyAnswer(qId, value, option = null) {
    const q = questions.find((qu) => qu.id === qId);
    if (!q) return {};

    if (q.type === "multi") {
      answers[qId] = value;
      return {};
    }

    answers[qId] = value;

    if (option && option.end) {
      return { ended: true, finalMessage: option.finalMessage || "" };
    }
    if (option && option.next) {
      currentQuestionId = option.next;
      return { nextId: option.next };
    }
    const visible = getVisibleQuestions();
    const idx = visible.findIndex((qu) => qu.id === qId);
    if (idx >= 0 && idx < visible.length - 1) {
      currentQuestionId = visible[idx + 1].id;
    } else {
      currentQuestionId = null;
    }
    return {};
  }

  function setMultiAnswer(qId, values) {
    answers[qId] = values;
  }

  function getAnswers() {
    return { ...answers };
  }

  function reset() {
    Object.keys(answers).forEach((k) => delete answers[k]);
    currentQuestionId = null;
  }

  /**
   * Jump to a answered question: clears this question's answer and all later visible answers.
   * Only single/multi ids are valid targets.
   */
  function goToQuestion(qId) {
    const visible = getVisibleQuestions();
    const t = visible.findIndex(
      (qu) => qu.id === qId && (qu.type === "single" || qu.type === "multi")
    );
    if (t < 0) return false;
    for (let j = t; j < visible.length; j++) {
      const q = visible[j];
      if (q.type === "single" || q.type === "multi") delete answers[q.id];
    }
    currentQuestionId = qId;
    return true;
  }

  /** Move to the previous visible single/multi question and clear answers from there onward. */
  function goToPrevious() {
    const visible = getVisibleQuestions();
    const idx = visible.findIndex((qu) => qu.id === currentQuestionId);
    if (idx <= 0) return false;
    let t = idx - 1;
    while (t >= 0 && visible[t].type === "message") t--;
    if (t < 0) return false;
    const targetId = visible[t].id;
    return goToQuestion(targetId);
  }

  function getCurrentQuestionId() {
    return currentQuestionId;
  }

  return {
    get answers() {
      return getAnswers();
    },
    getCurrentQuestionId,
    getVisibleQuestions,
    getQuestionToShow,
    advanceToNext,
    getApplicableQuestions,
    allApplicableAnswered,
    applyAnswer,
    setMultiAnswer,
    getData,
    reset,
    goToQuestion,
    goToPrevious,
  };
}
