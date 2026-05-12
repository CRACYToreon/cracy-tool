/**
 * Renders one question at a time. When answered, moves to next (by option.next or next visible).
 */

import { mountReportCarousel } from "./report-carousel.js";

export function render(container, engine, callbacks = {}) {
  const { onEnd, onUpdate, getRecommendations, session, postSurveyConfig, buildAssembledReport } = callbacks;
  const state = { ended: false, finalMessage: null };
  const setEnded = (msg) => {
    state.ended = true;
    state.finalMessage = msg;
    if (onEnd) onEnd(state);
    renderToDom();
  };

  function afterRender(opts) {
    if (onUpdate) onUpdate(opts || {});
  }

  function renderToDom() {
    container.closest(".survey-main")?.classList.remove("survey-main--report-focus");
    container.innerHTML = "";
    if (state.ended && state.finalMessage) {
      const block = document.createElement("div");
      block.className = "survey-final-message";
      block.innerHTML = "<h2 class=\"survey-outcome-title\">Outcome</h2>" + formatMessage(state.finalMessage);
      container.appendChild(block);
      afterRender({ surveyComplete: true });
      return;
    }

    const q = engine.getQuestionToShow();
    if (!q) {
      afterRender();
      return;
    }

    const el = document.createElement("div");
    el.className = "survey-question";
    el.dataset.questionId = q.id;

    const label = document.createElement("div");
    label.className = "survey-question-text";
    label.innerHTML = formatMessage(q.text);

    if (q.type === "message") {
      el.classList.add("survey-message", "survey-result-page");
      const isEnd = q.id === "END";
      const phase = session && isEnd ? session.phase : "report";

      if (isEnd && session && postSurveyConfig && phase === "frameworks") {
        const panel = document.createElement("div");
        panel.className = "survey-framework-panel";
        const title = document.createElement("h2");
        title.className = "survey-result-hero-title";
        title.textContent = "Choose frameworks for your report";
        panel.appendChild(title);
        const sub = document.createElement("p");
        sub.className = "survey-result-hero-lead";
        sub.textContent = postSurveyConfig.text || "Select which security frameworks to include in your CRA control mapping. You can change this each time before generating the report.";
        panel.appendChild(sub);
        const grid = document.createElement("div");
        grid.className = "survey-framework-grid";
        const keys = postSurveyConfig.option_keys || [];
        const labels = postSurveyConfig.labels || {};
        keys.forEach((key) => {
          const wrap = document.createElement("label");
          wrap.className = "survey-framework-tile";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.value = key;
          input.checked = true;
          input.name = "framework-choice";
          const span = document.createElement("span");
          span.className = "survey-framework-tile__text";
          span.textContent = labels[key] || key;
          wrap.appendChild(input);
          wrap.appendChild(span);
          grid.appendChild(wrap);
        });
        panel.appendChild(grid);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn--primary survey-framework-cta";
        btn.textContent = "Generate report";
        btn.addEventListener("click", () => {
          const checked = Array.from(el.querySelectorAll('input[name="framework-choice"]:checked')).map((i) => i.value);
          if (checked.length === 0) {
            alert("Select at least one framework.");
            return;
          }
          session.selectedFrameworks = checked;
          session.phase = "report";
          renderToDom();
        });
        panel.appendChild(btn);
        el.appendChild(panel);
        container.appendChild(el);
        afterRender({ surveyComplete: true });
        return;
      }

      if (getRecommendations && typeof getRecommendations === "function") {
        const hero = document.createElement("div");
        hero.className = "survey-result-hero survey-result-hero--opening";
        const kicker = document.createElement("p");
        kicker.className = "survey-result-hero__kicker";
        kicker.textContent = "Questionnaire complete";
        hero.appendChild(kicker);
        const heroTitle = document.createElement("h2");
        heroTitle.className = "survey-result-hero-title";
        heroTitle.textContent = "Your assessment report";
        hero.appendChild(heroTitle);
        const intro = document.createElement("p");
        intro.className = "survey-result-hero-lead";
        intro.textContent =
          "The next screens summarise your answers: practical recommendations first, then your inputs and profile, then CRA requirements with illustrative links to the frameworks you selected (project-authored cross-mappings, not official ENISA or standards-body tables). Use Back and Next to move through each section.";
        hero.appendChild(intro);
        const reportCue = document.createElement("p");
        reportCue.className = "survey-result-hero-reportcue";
        reportCue.innerHTML =
          "<strong>Where is the full report?</strong> Scroll below the recommendations. The <strong>Detailed report: CRA requirements and frameworks</strong> section contains your digest, CRA rows, and framework references, with Back and Next on the carousel to move through each part.";
        hero.appendChild(reportCue);
        const panel = document.createElement("div");
        panel.className = "survey-result-hero__panel";
        const panelTitle = document.createElement("h3");
        panelTitle.className = "survey-result-hero__panel-title";
        panelTitle.textContent = "What you will see";
        panel.appendChild(panelTitle);
        const panelList = document.createElement("ul");
        panelList.className = "survey-result-hero__panel-list";
        [
          "Recommendations from your architecture, risk, credentials, and Question 8 answers",
          "Your answers, derived profile, and risk calibration targets",
          "Applicable CRA rows with framework references, one requirement per slide where needed",
        ].forEach((line) => {
          const li = document.createElement("li");
          li.textContent = line;
          panelList.appendChild(li);
        });
        panel.appendChild(panelList);
        hero.appendChild(panel);
        el.appendChild(hero);
        const rec = document.createElement("div");
        rec.className = "survey-recommendations-wrap survey-recommendations-wrap--pretty";
        rec.innerHTML = getRecommendations(engine);
        el.appendChild(rec);
      if (isEnd && buildAssembledReport && session && session.phase === "report" && Array.isArray(session.selectedFrameworks)) {
        const asm = document.createElement("div");
        asm.className = "survey-assembled-wrap survey-assembled-wrap--pretty";
        asm.innerHTML = buildAssembledReport(engine, session.selectedFrameworks);
        el.appendChild(asm);
      }
      if (isEnd && getRecommendations && el.querySelector(".survey-recommendations-wrap")) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => mountReportCarousel(el));
        });
      }
      afterRender({ surveyComplete: true });
      return;
    }
  }

    el.appendChild(label);

    const answer = engine.answers[q.id];
    const options = q.options || [];

    if (q.type === "single") {
      const name = `survey-${q.id}`;
      options.forEach((opt) => {
        const wrap = document.createElement("label");
        wrap.className = "survey-option";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = name;
        input.value = opt.value;
        if (answer === opt.value) input.checked = true;
        input.addEventListener("change", () => {
          const result = engine.applyAnswer(q.id, opt.value, opt);
          if (result.ended) {
            setEnded(result.finalMessage);
          } else {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => renderToDom());
            });
          }
        });
        wrap.appendChild(input);
        wrap.appendChild(document.createTextNode(" " + opt.label));
        el.appendChild(wrap);
      });
    } else if (q.type === "multi") {
      const selected = Array.isArray(answer) ? answer : [];
      options.forEach((opt) => {
        const wrap = document.createElement("label");
        wrap.className = "survey-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = opt.value;
        if (selected.includes(opt.value)) input.checked = true;
        input.addEventListener("change", () => {
          const next = selected.filter((v) => v !== opt.value);
          if (input.checked) next.push(opt.value);
          engine.setMultiAnswer(q.id, next);
          renderToDom();
        });
        wrap.appendChild(input);
        wrap.appendChild(document.createTextNode(" " + opt.label));
        el.appendChild(wrap);
      });
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "btn btn--primary survey-next";
      nextBtn.textContent = "Next";
      nextBtn.addEventListener("click", () => {
        engine.advanceToNext();
        renderToDom();
      });
      el.appendChild(nextBtn);
    }

    container.appendChild(el);
    afterRender();
  }

  function formatMessage(text) {
    if (!text) return "";
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function clearEnded() {
    state.ended = false;
    state.finalMessage = null;
  }

  renderToDom();
  return { render: renderToDom, setEnded, clearEnded };
}
