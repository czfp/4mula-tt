// Student lesson flow, activities, speech feedback, groups, profile, and quick assessments.

    function findLessonByKey(db, key){
      const [g, subject, lessonId] = key.split("||");
      const grade = parseInt(g, 10);
      return db.lessons.find(l => l.gradeLevel===grade && l.subject===subject && l.lessonId===lessonId) || null;
    }

    let ttsUtter = null;
    let recognizer = null;

    function stopAllAudio(){
      if(ttsUtter){ try { window.speechSynthesis.cancel(); } catch {} ttsUtter = null; }
      if(recognizer){ try { recognizer.stop(); } catch {} recognizer = null; }
    }

    function backFromLesson(){ stopAllAudio(); go('screen-lessons'); }

    function openLesson(key){
      if(session.role !== "student"){ notify("Student view only.", "warn"); return; }
      const db = getDB();
      const st = db.students[session.studentId];
      if(!st) return;
      const lesson = findLessonByKey(db, key);
      if(!lesson){ notify("Lesson not found.", "bad"); return; }
      session.currentLessonKey = key;
      logEvent("student", st.id, "lesson_opened", { lessonId: lesson.lessonId, subject: lesson.subject });

      document.getElementById('lesson-title').textContent = `${subjectIcon(lesson.subject)} ${lesson.title}`;
      document.getElementById('lesson-xp').textContent = lesson.xp;
      document.getElementById('lesson-instructions').textContent = lesson.instructions || "";
      document.getElementById('lesson-passage').textContent = lesson.passage || "";
      document.getElementById('speech-feedback').innerHTML = `<div class="muted">Tip: Gamitin ang “Magsalita” para sa pronunciation feedback.</div>`;
      renderLessonActivity(lesson);
      go('screen-lesson');
    }

    function renderLessonActivity(lesson){
      const wrap = document.getElementById('lesson-activity');
      wrap.innerHTML = "";
      if(lesson.activityItems && lesson.activityItems.length) wrap.appendChild(renderMCQ(lesson));
      if(lesson.writingTask) wrap.appendChild(renderWriting(lesson));
      if(lesson.oralTask) wrap.appendChild(renderOral(lesson));
    }

    function escapeHTML(s){ return String(s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

    function renderMCQ(lesson){
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div class="section-title">🧠 Pag-unawa</div><div id="mcq-wrap"></div><div id="mcq-feedback"></div>`;
      const wrap = card.querySelector('#mcq-wrap');
      const fb = card.querySelector('#mcq-feedback');
      wrap.innerHTML = lesson.activityItems.map((it, qi) => {
        const opts = it.options.map((o, oi) =>
          `<button class="btn btn-outline btn-sm" style="width:100%;justify-content:flex-start;margin:6px 0" onclick="answerMCQ(${qi}, ${oi})">${String.fromCharCode(65+oi)}. ${escapeHTML(o)}</button>`
        ).join("");
        return `<div class="card" style="box-shadow:none;background:var(--bg);margin:10px 0"><div style="font-weight:900;margin-bottom:8px">Q${qi+1}. ${escapeHTML(it.q)}</div><div id="mcq-q-${qi}">${opts}</div></div>`;
      }).join("");
      fb.innerHTML = `<div class="muted">Sagutin ang mga tanong. Ang score ay itatala sa activity logs.</div>`;
      return card;
    }

    function answerMCQ(qi, oi){
      const db = getDB();
      const st = db.students[session.studentId];
      const lesson = findLessonByKey(db, session.currentLessonKey);
      if(!st || !lesson) return;
      const it = lesson.activityItems[qi];
      const correct = (oi === it.correct);
      const qWrap = document.getElementById(`mcq-q-${qi}`);
      if(qWrap){
        qWrap.querySelectorAll('button').forEach((b, idx) => {
          b.disabled = true;
          b.classList.remove('btn-outline');
          if(idx === it.correct) b.classList.add('btn-green');
          if(idx === oi && !correct) b.classList.add('btn-danger');
        });
      }
      const fb = document.getElementById('mcq-feedback');
      fb.innerHTML = correct ? `<div class="feedback ok">✅ Tama! Magaling!</div>` : `<div class="feedback bad">❌ Hindi tama. Basahin muli at subukan ulit.</div>`;
      logEvent("student", st.id, "mcq_answered", { lessonId: lesson.lessonId, qIndex: qi, selected: oi, correct });
    }

    function renderWriting(lesson){
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="section-title">✍️ Pagsulat</div>
        <div class="muted">${escapeHTML(lesson.writingTask.prompt || "")}</div>
        <div class="divider"></div>
        <textarea class="input-field" id="writing-text" placeholder="Isulat dito ang sagot mo..."></textarea>
        <div class="divider"></div>
        <button class="btn btn-blue" onclick="submitWriting()">📩 Ipasa at Kumuha ng AI Feedback</button>
        <div class="divider"></div>
        <div id="writing-feedback"></div>`;
      return card;
    }

    function simpleWritingFeedback(text){
      const t = text.trim();
      const wordCount = t ? t.split(/\s+/).length : 0;
      const sentenceCount = (t.match(/[.!?]+/g) || []).length || (t ? 1 : 0);
      const hasPunct = /[,.!?]/.test(t);
      const hasExampleHints = /(halimbawa|dahil|sapagkat|kaya|upang)/i.test(t);
      let score = 0;
      if(wordCount >= 30) score += 30; else score += Math.round((wordCount/30)*30);
      if(sentenceCount >= 3) score += 25; else score += Math.round((sentenceCount/3)*25);
      if(hasPunct) score += 15;
      if(hasExampleHints) score += 15;
      if(wordCount >= 12) score += 15;
      score = Math.min(100, score);
      const tips = [];
      if(wordCount < 30) tips.push("Dagdagan ang detalye (mas mahabang paliwanag).");
      if(sentenceCount < 3) tips.push("Gumamit ng mas maraming pangungusap (3+).");
      if(!hasPunct) tips.push("Gumamit ng bantas (.,!?).");
      if(!hasExampleHints) tips.push("Magdagdag ng halimbawa o salitang nagpapaliwanag (hal. dahil, halimbawa).");
      const label = score >= 85 ? "Napakahusay" : score >= 70 ? "Magaling" : score >= 50 ? "Katamtaman" : "Kailangan pa ng practice";
      return { score, label, tips };
    }

    function submitWriting(){
      const db = getDB();
      const st = db.students[session.studentId];
      const lesson = findLessonByKey(db, session.currentLessonKey);
      if(!st || !lesson) return;
      const text = (document.getElementById('writing-text').value || "").trim();
      const fbWrap = document.getElementById('writing-feedback');
      if(!text){ fbWrap.innerHTML = `<div class="feedback bad">❌ Wala pang sagot. Sumulat muna bago ipasa.</div>`; return; }
      const fb = simpleWritingFeedback(text);
      st.writingSubmissions[lesson.lessonId] = { at: nowISO(), text, score: fb.score, label: fb.label };
      st.updatedAt = nowISO(); st.lastActiveAt = nowISO();
      saveDB(db);
      logEvent("student", st.id, "writing_submitted", { lessonId: lesson.lessonId, score: fb.score });
      fbWrap.innerHTML = `
        <div class="feedback ${fb.score>=70?'ok':fb.score>=50?'warn':'bad'}">
          <div style="font-family:'Fredoka One',cursive;font-size:18px">🧠 AI Feedback: ${fb.label} (${fb.score}%)</div>
          <div style="margin-top:8px">
            ${fb.tips.length ? "<b>Mga Tip:</b><ul style='margin-top:6px;padding-left:18px'>" + fb.tips.map(t=>`<li>${escapeHTML(t)}</li>`).join("") + "</ul>"
              : "<b>Good job!</b> Kumpleto ang sagot at malinaw ang paliwanag."}
          </div>
        </div>`;
      notify("Writing submitted ✅");
    }

    function renderOral(lesson){
      const card = document.createElement('div');
      card.className = 'card';
      const prompts = (lesson.oralTask.prompts || []).map(p => `<li style="margin:6px 0;font-weight:900">${escapeHTML(p)}</li>`).join("");
      card.innerHTML = `<div class="section-title">🎙️ Oral Task</div><div class="muted">Tip: Pindutin ang “Magsalita” sa itaas para ma-record at masukat ang clarity vs target.</div><div class="divider"></div><ul style="padding-left:18px">${prompts}</ul>`;
      return card;
    }

    function normalizeText(s){
      return String(s || "")
        .toLowerCase()
        .replace(/[“”"']/g, "")
        .replace(/[^a-z0-9ñáéíóúü\s]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function tokenizeWords(s){
      const t = normalizeText(s);
      return t ? t.split(" ").filter(Boolean) : [];
    }

    function levenshteinSeq(a, b){
      // Works for strings (characters) or arrays (words).
      const isArrA = Array.isArray(a);
      const isArrB = Array.isArray(b);
      const A = isArrA ? a : String(a || "");
      const B = isArrB ? b : String(b || "");
      const n = A.length, m = B.length;
      if(n === 0) return m;
      if(m === 0) return n;

      const dp = Array.from({length:n+1}, ()=>new Array(m+1).fill(0));
      for(let i=0;i<=n;i++) dp[i][0]=i;
      for(let j=0;j<=m;j++) dp[0][j]=j;

      for(let i=1;i<=n;i++){
        for(let j=1;j<=m;j++){
          const ai = isArrA ? A[i-1] : A.charAt(i-1);
          const bj = isArrB ? B[j-1] : B.charAt(j-1);
          const cost = ai === bj ? 0 : 1;
          dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
        }
      }
      return dp[n][m];
    }

    function charSimilarityPct(target, spoken){
      const t = normalizeText(target);
      const s = normalizeText(spoken);
      if(!t || !s) return 0;
      const dist = levenshteinSeq(t, s);
      const maxLen = Math.max(t.length, s.length) || 1;
      return Math.max(0, Math.round((1 - dist/maxLen) * 100));
    }

    function wordSimilarityPct(target, spoken){
      const tw = tokenizeWords(target);
      const sw = tokenizeWords(spoken);
      if(!tw.length || !sw.length) return 0;

      // word-level edit similarity (good when student says the full target)
      const dist = levenshteinSeq(tw, sw);
      const maxLen = Math.max(tw.length, sw.length) || 1;
      return Math.max(0, Math.round((1 - dist/maxLen) * 100));
    }

    function bestWindowWordSimilarityPct(target, spoken){
      // Helps when speech recognition returns a partial phrase (common in browsers).
      const A = tokenizeWords(target);
      const B = tokenizeWords(spoken);
      if(!A.length || !B.length) return 0;

      let longer = A, shorter = B;
      if(B.length > A.length){ longer = B; shorter = A; }

      const shortLen = shorter.length;
      let best = 0;

      // Try a few window sizes around the shorter length.
      const sizes = [shortLen-2, shortLen-1, shortLen, shortLen+1, shortLen+2].filter(x => x >= 2);
      for(const size of sizes){
        for(let i=0; i<=longer.length - size; i++){
          const window = longer.slice(i, i+size);
          const dist = levenshteinSeq(window, shorter);
          const maxLen = Math.max(window.length, shorter.length) || 1;
          const pct = Math.max(0, Math.round((1 - dist/maxLen) * 100));
          if(pct > best) best = pct;
        }
      }
      return best;
    }

    function similarityPct(target, spoken){
      // Robust scoring: take the BEST of
      // 1) character similarity
      // 2) word-level similarity
      // 3) best-window word similarity (handles partial transcripts)
      const c = charSimilarityPct(target, spoken);
      const w = wordSimilarityPct(target, spoken);
      const bw = bestWindowWordSimilarityPct(target, spoken);
      return Math.max(c, w, bw);
    }

    function bestSimilarityPct(targetVariants, spoken){
      // Accept multiple targets (ex: with/without student name).
      const arr = Array.isArray(targetVariants) ? targetVariants : [targetVariants];
      let best = 0;
      for(const t of arr){
        const pct = similarityPct(t, spoken);
        if(pct > best) best = pct;
      }
      return best;
    }

    function ttsSpeakPassage(){
      const db = getDB();
      const lesson = findLessonByKey(db, session.currentLessonKey);
      if(!lesson) return;
      stopAllAudio();
      const text = lesson.passage || "";
      if(!text){ notify("Walang text sa lesson.", "warn"); return; }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang="fil-PH"; utter.rate=0.95; utter.pitch=1.0;
      utter.onend = ()=>{ ttsUtter=null; };
      ttsUtter = utter;
      try{ window.speechSynthesis.speak(utter); logEvent("student", session.studentId, "tts_played", { lessonId: lesson.lessonId }); }
      catch{ notify("TTS not supported on this browser.", "bad"); }
    }

    function startPronunciation(){
      const db = getDB();
      const st = db.students[session.studentId];
      const lesson = findLessonByKey(db, session.currentLessonKey);
      if(!st || !lesson) return;
      stopAllAudio();
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!SpeechRecognition){
        document.getElementById('speech-feedback').innerHTML = `<div class="feedback bad">❌ Speech recognition not supported in this browser.</div>`;
        return;
      }
      recognizer = new SpeechRecognition();
      recognizer.lang="fil-PH"; recognizer.interimResults=false; recognizer.maxAlternatives=1;
      const target = (lesson.speechTarget || lesson.passage || "").replace("_____", st.name);
      const targetVariants = [
        target,
        // Allow students to speak without the name/fill-in (common for "_____" prompts)
        target.replace(st.name, "").replace(/\s+/g, " ").trim(),
        target.replace("_____", "").replace(/\s+/g, " ").trim(),
      ].filter(t => t && t.length >= 3);

      document.getElementById('speech-feedback').innerHTML = `<div class="feedback warn"><div style="font-family:'Fredoka One',cursive;font-size:18px">🎤 Listening...</div><div class="muted" style="margin-top:6px">Target: "${escapeHTML(target)}"</div></div>`;
      recognizer.onresult = (event)=>{
        const spoken = event.results?.[0]?.[0]?.transcript || "";
        const pct = bestSimilarityPct(targetVariants, spoken);
        st.speechAttempts[lesson.lessonId] = st.speechAttempts[lesson.lessonId] || [];
        st.speechAttempts[lesson.lessonId].push({ at: nowISO(), target, spoken, pct });
        st.lastActiveAt = nowISO(); st.updatedAt = nowISO();
        saveDB(db);
        logEvent("student", st.id, "speech_attempt", { lessonId: lesson.lessonId, pct, spoken });
        const cls = pct>=80?"ok":pct>=60?"warn":"bad";
        const msg = pct>=80 ? "Malinaw ang bigkas! 👏" : pct>=60 ? "Okay na, pero puwedeng mas malinaw pa." : "Subukan ulit—bagalan at linawin ang bigkas.";
        document.getElementById('speech-feedback').innerHTML = `<div class="feedback ${cls}"><div style="font-family:'Fredoka One',cursive;font-size:18px">🗣️ Pronunciation Score: ${pct}%</div><div style="margin-top:6px"><b>Spoken:</b> "${escapeHTML(spoken)}"</div><div class="muted" style="margin-top:6px"><b>Target:</b> "${escapeHTML(target)}"</div><div style="margin-top:10px">${escapeHTML(msg)}</div></div>`;
        if(pct>=80) awardXP(st.id, 8, "Speech practice (Excellent) +8 XP");
        else if(pct>=60) awardXP(st.id, 5, "Speech practice +5 XP");
        else awardXP(st.id, 2, "Speech practice +2 XP");
        renderStudentDash();
      };
      recognizer.onerror = ()=>{ document.getElementById('speech-feedback').innerHTML = `<div class="feedback bad">❌ Speech error. Subukan ulit.</div>`; };
      recognizer.onend = ()=>{ recognizer=null; };
      try{ recognizer.start(); } catch { notify("Mic busy or blocked.", "bad"); }
    }


    function renderProfile(){
      const db = getDB();
      const st = db.students[session.studentId];
      if(!st) return;
      renderAvatars();
      const completed = Object.keys(st.completedLessons).length;
      const quizAvg = averageQuiz(st);
      const lastActive = st.lastActiveAt ? new Date(st.lastActiveAt).toLocaleString() : "—";
      document.getElementById('profile-summary').innerHTML = `
        <div class="row" style="justify-content:space-between">
          <div class="badge badge-ok">⚡ XP: ${st.xp}</div>
          <div class="badge badge-warn">🌟 Level: ${levelOfXP(st.xp)}</div>
          <div class="badge badge-ok">🏅 Badges: ${(st.badges||[]).length}</div>
        </div>
        <div class="divider"></div>
        <div class="muted"><b>Name:</b> ${escapeHTML(st.name)}</div>
        <div class="muted"><b>Grade/Section:</b> Baitang ${st.gradeLevel} • ${escapeHTML(st.section)}</div>
        <div class="muted"><b>Completed Lessons:</b> ${completed}</div>
        <div class="muted"><b>Quiz Average:</b> ${quizAvg}%</div>
        <div class="muted"><b>Last Active:</b> ${escapeHTML(lastActive)}</div>`;
    }

    const QUIZ_BANK = {
      early: [
        { q:"Ano ang makikita mo sa salitang 'araw'?", options:["☀️ Araw","🌧️ Ulan","🌙 Buwan","⭐ Bituin"], correct:0, reward:"Reading Star" },
        { q:"Alin ang magalang na pagbati sa guro?", options:["Hoy!","Magandang umaga po!","Uy!","Bilisan mo!"], correct:1, reward:"Manners Star" },
        { q:"Alin ang pangngalan?", options:["tumakbo","masaya","lapis","mabilis"], correct:2, reward:"Word Star" },
        { q:"Ano ang dapat gawin kapag may kaklase kang nahihirapan?", options:["Tumawa","Mang-inis","Tumulong","Umalis"], correct:2, reward:"Kindness Star" },
        { q:"Piliin ang tamang bantas sa dulo: 'Salamat po___'", options:["!","?",",","-"], correct:0, reward:"Writing Star" },
      ],
      standard: [
        {q:"Ano ang dapat gawin kapag nagbabasa ng balita online?", options:["I-share agad","Suriin ang pinagmulan at ebidensiya","Maniwala sa lahat","Huwag magbasa"], correct:1, reward:"Media Smart"},
        {q:"Alin ang halimbawa ng pang-uri?", options:["kumain","mabango","puno","bahay"], correct:1, reward:"Word Explorer"},
        {q:"Ano ang aral ng salawikain: \"Kung ano ang itinanim, siya ring aanihin\"?", options:["Makukuha mo ang bunga ng iyong gawa","Masarap ang ani","Huwag magtanim","Matulog nang maaga"], correct:0, reward:"Wisdom Star"},
        {q:"Alin ang magandang pagbati sa guro?", options:["Hoy!","Uy!","Magandang umaga po!","Ano ba!"], correct:2, reward:"Respect Star"},
        {q:"Ano ang mainam sa pagtutulungan?", options:["Nagiging magaan ang gawain","Lumalala ang problema","Walang nangyayari","Nawawala ang oras"], correct:0, reward:"Teamwork Star"},
      ]
    };

    const quickQuizState = { items:[], index:0, score:0, answered:false };

    function quickQuizItemsForStudent(st){
      return isEarlyGradeStudent(st) ? QUIZ_BANK.early : QUIZ_BANK.standard;
    }

    function closeQuickQuiz(){
      const modal = document.getElementById('quiz-modal');
      if(modal) modal.classList.remove('active');
      quickQuizState.items = [];
      quickQuizState.index = 0;
      quickQuizState.score = 0;
      quickQuizState.answered = false;
    }

    function renderQuickQuizStep(){
      const body = document.getElementById('quiz-modal-body');
      const title = document.getElementById('quiz-modal-title');
      const meta = document.getElementById('quiz-modal-meta');
      const score = document.getElementById('quiz-modal-score');
      const nextBtn = document.getElementById('quiz-next-btn');
      if(!body || !title || !meta || !score || !nextBtn) return;

      const item = quickQuizState.items[quickQuizState.index];
      if(!item) return;
      title.textContent = isEarlyGradeStudent(getDB().students[session.studentId]) ? "🎮 Star Quiz" : "🎮 Quick Quiz";
      meta.textContent = `Tanong ${quickQuizState.index + 1} sa ${quickQuizState.items.length} • Reward: ${item.reward}`;
      score.textContent = quickQuizState.score;
      nextBtn.disabled = !quickQuizState.answered;
      nextBtn.textContent = quickQuizState.index === quickQuizState.items.length - 1 ? 'Tapusin 🎉' : 'Sunod ➜';

      body.innerHTML = `
        <div class="quiz-question-shell">
          <div class="quiz-question">${escapeHTML(item.q)}</div>
          <div class="quiz-option-grid">
            ${item.options.map((opt, idx) => `
              <button class="quiz-option" id="quiz-option-${idx}" onclick="answerQuickQuiz(${idx})">
                <span class="quiz-option-letter">${String.fromCharCode(65+idx)}</span>
                <span>${escapeHTML(opt)}</span>
              </button>
            `).join('')}
          </div>
          <div id="quiz-answer-feedback" class="muted" style="margin-top:12px">Piliin ang pinakamahusay na sagot.</div>
        </div>`;
    }

    function answerQuickQuiz(choiceIndex){
      if(quickQuizState.answered) return;
      const item = quickQuizState.items[quickQuizState.index];
      if(!item) return;
      quickQuizState.answered = true;
      const correct = choiceIndex === item.correct;
      if(correct) quickQuizState.score += 1;

      item.options.forEach((_, idx) => {
        const btn = document.getElementById(`quiz-option-${idx}`);
        if(!btn) return;
        btn.disabled = true;
        if(idx === item.correct) btn.classList.add('correct');
        if(idx === choiceIndex && !correct) btn.classList.add('wrong');
      });

      const feedback = document.getElementById('quiz-answer-feedback');
      if(feedback){
        feedback.innerHTML = correct
          ? `<div class="feedback ok">✅ Tama! Nakuha mo ang ${escapeHTML(item.reward)}.</div>`
          : `<div class="feedback warn">🌈 Good try! Tamang sagot: <b>${escapeHTML(item.options[item.correct])}</b></div>`;
      }
      document.getElementById('quiz-modal-score').textContent = quickQuizState.score;
      document.getElementById('quiz-next-btn').disabled = false;
    }

    function nextQuickQuizStep(){
      if(!quickQuizState.answered) return;
      if(quickQuizState.index < quickQuizState.items.length - 1){
        quickQuizState.index += 1;
        quickQuizState.answered = false;
        renderQuickQuizStep();
        return;
      }
      finishQuickQuiz();
    }

    function finishQuickQuiz(){
      const db = getDB();
      const st = db.students[session.studentId];
      if(!st) return;
      const total = quickQuizState.items.length || 1;
      const score = quickQuizState.score;
      const pct = Math.round((score/total)*100);
      const xpEarned = score * 10;
      st.quizHistory = st.quizHistory || [];
      st.quizHistory.push({ at: nowISO(), score, total, pct });
      st.updatedAt = nowISO();
      st.lastActiveAt = nowISO();
      saveDB(db);
      logEvent("student", st.id, "quiz_completed", { score, total, pct, xpEarned });
      awardXP(st.id, xpEarned, `Quiz completed (${score}/${total})`);

      const body = document.getElementById('quiz-modal-body');
      const meta = document.getElementById('quiz-modal-meta');
      const nextBtn = document.getElementById('quiz-next-btn');
      if(meta) meta.textContent = `Final Score: ${score}/${total} • +${xpEarned} XP`;
      if(body){
        body.innerHTML = `
          <div class="quiz-question-shell quiz-finish-shell">
            <div class="quiz-finish-emoji">${pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '🌈'}</div>
            <div class="quiz-question">${pct >= 80 ? 'Ang galing mo!' : pct >= 60 ? 'Nice work!' : 'Good try!'}</div>
            <div class="muted" style="font-size:14px">Nakakuha ka ng <b>${score}/${total}</b> at <b>+${xpEarned} XP</b>.</div>
          </div>`;
      }
      if(nextBtn){
        nextBtn.disabled = false;
        nextBtn.textContent = 'Close';
        nextBtn.onclick = function(){
          closeQuickQuiz();
          this.onclick = nextQuickQuizStep;
          renderStudentDash();
        };
      }
      notify(`Quiz done: ${score}/${total} (${pct}%) +${xpEarned} XP`);
    }

    function startQuickQuiz(){
      if(session.role !== "student"){ notify("Student view only.", "warn"); return; }
      const db = getDB();
      const st = db.students[session.studentId];
      if(!st) return;
      quickQuizState.items = quickQuizItemsForStudent(st);
      quickQuizState.index = 0;
      quickQuizState.score = 0;
      quickQuizState.answered = false;
      const modal = document.getElementById('quiz-modal');
      if(modal) modal.classList.add('active');
      const nextBtn = document.getElementById('quiz-next-btn');
      if(nextBtn) nextBtn.onclick = nextQuickQuizStep;
      renderQuickQuizStep();
    }
