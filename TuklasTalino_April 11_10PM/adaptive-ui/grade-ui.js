// Grade-aware student dashboard rendering helpers.

    function safeText(value){
      return String(value || "").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    function isEarlyGradeStudent(st){
      return !!st && Number(st.gradeLevel) <= 2;
    }

    function subjectTheme(subject){
      const map = {
        "Pagbasa":      { icon:"📖", bg:"#DFF7E8", accent:"#2ECC71", tag:"Kwento" },
        "Bokabularyo":  { icon:"🔤", bg:"#DFF2FF", accent:"#3498DB", tag:"Salita" },
        "Panitikan":    { icon:"📜", bg:"#FFF0DD", accent:"#F39C12", tag:"Tula" },
        "Oral Comm":    { icon:"🎙️", bg:"#FFE2EA", accent:"#E67EA2", tag:"Bigkas" },
        "Pagsulat":     { icon:"✍️", bg:"#FFF8CF", accent:"#F1C40F", tag:"Sulatin" },
        "Grupo":        { icon:"👥", bg:"#EFE5FF", accent:"#9B59B6", tag:"Sama-sama" },
      };
      return map[subject] || { icon:"📚", bg:"#F6F6F6", accent:"#95A5A6", tag:"Aralin" };
    }

    function studentLessonsForSubject(db, st, subject){
      return db.lessons.filter(l => l.gradeLevel === st.gradeLevel && l.subject === subject).sort((a,b)=>a.lessonId.localeCompare(b.lessonId));
    }

    function dayKey(){
      const d=new Date();
      return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
    }

    function pickDailySubject(){
      const subjects=["Pagbasa","Bokabularyo","Panitikan","Oral Comm","Pagsulat"];
      return subjects[dayKey()%subjects.length];
    }

    function subjectIcon(subject){
      return subjectTheme(subject).icon;
    }

    function completedCountBySubject(st, subject){
      return Object.values(st.completedLessons || {}).filter(x => x && x.subject === subject).length;
    }

    function totalCompletedLessons(st){
      return Object.keys(st.completedLessons || {}).length;
    }

    function totalSubjectsForGrade(db, st){
      return ["Pagbasa","Bokabularyo","Panitikan","Oral Comm","Pagsulat"].map(subj => {
        const total = db.lessons.filter(l => l.gradeLevel === st.gradeLevel && l.subject === subj).length;
        const done = completedCountBySubject(st, subj);
        const pct = total ? Math.round((done/total)*100) : 0;
        return { subj, total, done, pct, theme: subjectTheme(subj) };
      });
    }

    function learningStars(st){
      return Math.min(12, totalCompletedLessons(st) + ((st.badges || []).length * 2) + Math.floor((st.xp || 0) / 40));
    }

    function nextBadge(st){
      const owned = new Set(st.badges || []);
      return BADGE_DEFS.find(b => !owned.has(b.id)) || null;
    }

    function getUpcomingTasksData(db, st){
      const tasks = [];
      for(const g of Object.values(db.groups || {})){
        if(g.section !== st.section) continue;
        if(!g.memberIds?.includes(st.id)) continue;

        for(const t of (g.tasks || [])){
          const done = !!t.statusByStudent?.[st.id];
          if(done || !t.deadline) continue;
          const dt = new Date(t.deadline);
          if(isNaN(dt.getTime())) continue;
          tasks.push({
            groupName: g.name,
            groupId: g.id,
            taskId: t.id,
            title: t.title,
            deadline: t.deadline,
            xp: t.xp || 0,
            overdue: dt.getTime() < Date.now()
          });
        }
      }
      tasks.sort((a,b)=>new Date(a.deadline)-new Date(b.deadline));
      return tasks;
    }

    function leaderboardRows(db, st){
      return Object.values(db.students)
        .filter(x => x.section === st.section)
        .sort((a,b)=>b.xp-a.xp)
        .slice(0,10);
    }

    function renderDaily(db, st){
      const wrap = document.getElementById('daily-wrap');
      if(!wrap) return;
      const subject = pickDailySubject();
      const pool = studentLessonsForSubject(db, st, subject);
      const lesson = pool.length ? pool[dayKey()%pool.length] : null;

      const quizCard = `
        <div class="lesson-card" style="border-color:var(--purple)" onclick="startQuickQuiz()">
          <div class="lesson-icon">🧩</div>
          <div>
            <div style="font-weight:900">Mini Quiz</div>
            <div class="muted">5 tanong • +50 XP (depende sa score)</div>
          </div>
          <div class="lesson-xp">+ up to 50 XP</div>
        </div>
      `;

      const lessonCard = lesson ? `
        <div class="lesson-card" onclick="openLesson('${lesson.gradeLevel}||${lesson.subject}||${lesson.lessonId}')">
          <div class="lesson-icon">${subjectIcon(lesson.subject)}</div>
          <div>
            <div style="font-weight:900">${safeText(lesson.title)}</div>
            <div class="muted">${safeText(lesson.subject)} • ${safeText(lesson.duration)}</div>
          </div>
          <div class="lesson-xp">+${lesson.xp} XP</div>
        </div>
      ` : `<div class="card"><div class="muted">Walang daily lesson para sa ${safeText(subject)}. (Add more lessons to DB.)</div></div>`;

      wrap.innerHTML = lessonCard + quizCard;
    }

    function goStudentTab(tab){
      if(session.role !== "student"){ notify("Student view only.", "warn"); return; }
      document.getElementById('bnav-stu-home').classList.toggle('active', tab==='home');
      document.getElementById('bnav-stu-groups').classList.toggle('active', tab==='groups');
      document.getElementById('bnav-stu-badges').classList.toggle('active', tab==='badges');
      document.getElementById('bnav-stu-profile').classList.toggle('active', tab==='profile');

      if(tab==='home') go('screen-student');
      if(tab==='groups') { go('screen-stu-groups'); renderStudentGroups(); }
      if(tab==='badges') { go('screen-stu-badges'); renderBadges(); }
      if(tab==='profile') { go('screen-stu-profile'); renderProfile(); }
    }

    function renderLeaderboard(db, st){
      const wrap = document.getElementById('lb-wrap');
      if(!wrap) return;
      const peers = leaderboardRows(db, st);
      if(!peers.length){ wrap.innerHTML = `<div class="muted">Walang students sa section.</div>`; return; }
      wrap.innerHTML = peers.map((p, idx) => `
        <div class="lesson-card" style="cursor:default;border-color:${idx===0?'var(--yellow)':'var(--green)'}">
          <div class="lesson-icon">${safeText(p.avatar || "👤")}</div>
          <div style="flex:1">
            <div style="font-weight:900">${idx+1}. ${safeText(p.name)} ${p.id===st.id ? "← Ikaw" : ""}</div>
            <div class="muted">Baitang ${p.gradeLevel} • ${safeText(p.section)}</div>
          </div>
          <div class="lesson-xp">${p.xp} XP</div>
        </div>
      `).join("");
    }

    function renderStudentProgress(db, st){
      const wrap = document.getElementById('stu-progress-wrap');
      if(!wrap) return;
      wrap.innerHTML = totalSubjectsForGrade(db, st).map(item => `
        <div class="lesson-card" style="cursor:pointer;border-color:var(--green)" onclick="openSubject('${item.subj}')">
          <div class="lesson-icon">${item.theme.icon}</div>
          <div style="flex:1">
            <div style="font-weight:900">${safeText(item.subj)}</div>
            <div class="muted">${item.done}/${item.total} completed</div>
            <div style="margin-top:8px">
              <div class="progress-bar"><div class="progress-fill" style="width:${item.pct}%"></div></div>
            </div>
          </div>
          <div class="lesson-xp">${item.pct}%</div>
        </div>
      `).join("");
    }

    function renderUpcomingTasks(db, st){
      const wrap = document.getElementById('stu-upcoming-wrap');
      if(!wrap) return;
      const tasks = getUpcomingTasksData(db, st);
      if(!tasks.length){
        wrap.innerHTML = `<div class="muted">Wala kang paparating na group tasks na may deadline. ✅</div>`;
        return;
      }
      wrap.innerHTML = tasks.slice(0,5).map(t => `
        <div class="lesson-card" style="cursor:default;border-color:${t.overdue?'#E74C3C':'var(--yellow)'}">
          <div class="lesson-icon">${t.overdue?'⏰':'📌'}</div>
          <div style="flex:1">
            <div style="font-weight:900">${safeText(t.title)}</div>
            <div class="muted">Group: ${safeText(t.groupName)} • Deadline: ${safeText(t.deadline)}</div>
          </div>
          <div class="lesson-xp">+${t.xp} XP</div>
        </div>
      `).join("");
    }

    function renderGrade12Dashboard(db, st){
      const zone = document.getElementById('grade12-dashboard');
      if(!zone) return;

      const todaySubject = pickDailySubject();
      const lessons = studentLessonsForSubject(db, st, todaySubject);
      const dailyLesson = lessons.length ? lessons[dayKey()%lessons.length] : null;
      const subjectStats = totalSubjectsForGrade(db, st);
      const nextUnlock = nextBadge(st);
      const stars = learningStars(st);
      const badgeCount = (st.badges || []).length;
      const quizCount = (st.quizHistory || []).length;
      const groups = studentGroups(db, st);
      const upcomingTasks = getUpcomingTasksData(db, st).slice(0,3);
      const leaders = leaderboardRows(db, st).slice(0,3);
      const badgeShelf = BADGE_DEFS.slice(0,5).map(b => {
        const owned = (st.badges || []).includes(b.id);
        return `
          <div class="kid-badge-pill ${owned ? 'owned' : 'locked'}" onclick="goStudentTab('badges')">
            <span class="kid-badge-icon">${b.icon}</span>
            <span>${owned ? safeText(b.name) : 'Locked Badge'}</span>
          </div>`;
      }).join('');

      zone.innerHTML = `
        <section class="kid-stage">
          <div class="kid-stage-head">
            <div>
              <div class="kid-stage-title">🎉 Tara, ${safeText(st.name)}!</div>
              <div class="kid-stage-sub">Maliliit na hakbang, maraming bituin, masayang pagkatuto.</div>
            </div>
            <div class="kid-star-meter">
              <div class="kid-star-label">Learning Stars</div>
              <div class="kid-stars-row">${Array.from({length:6}).map((_, idx) => `<span class="kid-star ${idx < Math.min(stars,6) ? 'on' : ''}">⭐</span>`).join('')}</div>
            </div>
          </div>

          <div class="kid-hero-grid">
            <div class="kid-hero-card kid-reward-card">
              <div class="kid-card-kicker">Reward Chest</div>
              <div class="kid-card-title">🪙 ${st.xp} XP • Level ${levelOfXP(st.xp)}</div>
              <div class="kid-card-copy">Kumuha ng XP sa lessons, quiz, at group quests.</div>
              <div class="kid-mini-progress"><span style="width:${xpPct(st.xp)}%"></span></div>
              <button class="btn btn-green kid-cta" onclick="startQuickQuiz()">🎮 Maglaro ng Quiz</button>
            </div>

            <div class="kid-hero-card kid-mission-card-main">
              <div class="kid-card-kicker">Mission of the Day</div>
              <div class="kid-card-title">${dailyLesson ? `${subjectIcon(dailyLesson.subject)} ${safeText(dailyLesson.title)}` : '📚 Pili ng lesson'}</div>
              <div class="kid-card-copy">${dailyLesson ? `Tapusin ang ${safeText(dailyLesson.subject)} mission at kunin ang +${dailyLesson.xp} XP.` : 'Magdagdag ng lesson para sa daily mission.'}</div>
              <button class="btn btn-blue kid-cta" ${dailyLesson ? `onclick="openLesson('${dailyLesson.gradeLevel}||${dailyLesson.subject}||${dailyLesson.lessonId}')"` : 'disabled'}>🚀 Simulan</button>
            </div>

            <div class="kid-hero-card kid-sticker-card">
              <div class="kid-card-kicker">Sticker Board</div>
              <div class="kid-card-title">🏅 ${badgeCount} badge${badgeCount===1?'':'s'} unlocked</div>
              <div class="kid-card-copy">${nextUnlock ? `Sunod na reward: ${safeText(nextUnlock.name)}` : 'Lahat ng badge sa demo ay unlocked mo na!'}</div>
              <button class="btn btn-purple kid-cta" onclick="goStudentTab('badges')">🌟 Tingnan ang Badges</button>
            </div>
          </div>
        </section>

        <section class="kid-panel">
          <div class="section-title">🧭 Learning Worlds</div>
          <div class="kid-subject-grid">
            ${subjectStats.map(item => `
              <button class="kid-subject-card" style="--kid-bg:${item.theme.bg};--kid-accent:${item.theme.accent}" onclick="${item.subj==='Grupo' ? `goStudentTab('groups')` : `openSubject('${item.subj}')`} ">
                <div class="kid-subject-top">
                  <span class="kid-subject-icon">${item.theme.icon}</span>
                  <span class="kid-subject-tag">${safeText(item.theme.tag)}</span>
                </div>
                <div class="kid-subject-name">${safeText(item.subj)}</div>
                <div class="kid-subject-meta">${item.done}/${item.total} tapos</div>
                <div class="kid-mini-progress"><span style="width:${item.pct}%"></span></div>
              </button>
            `).join('')}
            <button class="kid-subject-card" style="--kid-bg:#EFE5FF;--kid-accent:#9B59B6" onclick="goStudentTab('groups')">
              <div class="kid-subject-top">
                <span class="kid-subject-icon">👥</span>
                <span class="kid-subject-tag">Quest</span>
              </div>
              <div class="kid-subject-name">Grupo</div>
              <div class="kid-subject-meta">${groups.length} group${groups.length===1?'':'s'}</div>
              <div class="kid-mini-progress"><span style="width:${groups.length ? 100 : 20}%"></span></div>
            </button>
          </div>
        </section>

        <section class="kid-panel">
          <div class="section-title">🎯 Fun Missions</div>
          <div class="kid-mission-grid">
            <div class="kid-mission-box sunshine">
              <div class="kid-mission-emoji">🧩</div>
              <div class="kid-mission-name">Mini Quiz</div>
              <div class="kid-mission-copy">5 mabilis na tanong para sa stars at XP.</div>
              <button class="btn btn-yellow kid-cta" onclick="startQuickQuiz()">Play Quiz</button>
            </div>
            <div class="kid-mission-box mint">
              <div class="kid-mission-emoji">📚</div>
              <div class="kid-mission-name">Lesson Trail</div>
              <div class="kid-mission-copy">${totalCompletedLessons(st)} lesson${totalCompletedLessons(st)===1?'':'s'} completed na!</div>
              <button class="btn btn-green kid-cta" onclick="openSubject('${todaySubject}')">Open ${safeText(todaySubject)}</button>
            </div>
            <div class="kid-mission-box berry">
              <div class="kid-mission-emoji">🏆</div>
              <div class="kid-mission-name">Star Race</div>
              <div class="kid-mission-copy">Ikumpara ang XP mo sa section leaderboard.</div>
              <button class="btn btn-purple kid-cta" onclick="goStudentTab('badges')">See Rewards</button>
            </div>
          </div>
        </section>

        <section class="kid-panel kid-dual-grid">
          <div class="kid-mini-board">
            <div class="section-title">⭐ My Progress Path</div>
            <div class="kid-progress-stack">
              ${subjectStats.map(item => `
                <div class="kid-progress-row" onclick="openSubject('${item.subj}')">
                  <div class="kid-progress-subject">${item.theme.icon} ${safeText(item.subj)}</div>
                  <div class="kid-progress-stars">${Array.from({length:3}).map((_, idx) => `<span class="kid-star ${idx < Math.max(1, Math.round(item.pct/34)) && item.pct>0 ? 'on' : ''}">⭐</span>`).join('')}</div>
                  <div class="kid-chip">${item.pct}%</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="kid-mini-board">
            <div class="section-title">🎁 Sticker Shelf</div>
            <div class="kid-badge-shelf">${badgeShelf}</div>
            <div class="kid-mini-stats">
              <div class="kid-chip">📝 Quiz: ${quizCount}</div>
              <div class="kid-chip">🏅 Badges: ${badgeCount}</div>
              <div class="kid-chip">⭐ Stars: ${stars}</div>
            </div>
          </div>
        </section>

        <section class="kid-panel kid-dual-grid">
          <div class="kid-mini-board">
            <div class="section-title">🏁 Top Star Racers</div>
            ${leaders.length ? leaders.map((p, idx) => `
              <div class="kid-rank-row">
                <div class="kid-rank-left">
                  <span class="kid-rank-badge">${idx===0?'🥇':idx===1?'🥈':'🥉'}</span>
                  <span>${safeText(p.avatar || '👤')} ${safeText(p.name)} ${p.id===st.id ? '• Ikaw' : ''}</span>
                </div>
                <div class="kid-chip">${p.xp} XP</div>
              </div>
            `).join('') : `<div class="kid-empty">Wala pang laman ang leaderboard.</div>`}
          </div>

          <div class="kid-mini-board">
            <div class="section-title">⏰ Upcoming Quests</div>
            ${upcomingTasks.length ? upcomingTasks.map(t => `
              <div class="kid-task-row ${t.overdue ? 'danger' : ''}" onclick="goStudentTab('groups')">
                <div>
                  <div class="kid-task-title">${safeText(t.title)}</div>
                  <div class="kid-task-copy">${safeText(t.groupName)} • ${safeText(t.deadline)}</div>
                </div>
                <div class="kid-chip">+${t.xp} XP</div>
              </div>
            `).join('') : `<div class="kid-empty">Wala pang paparating na group quests. Nice! 🎉</div>`}
          </div>
        </section>
      `;
    }

    function renderStudentDash(){
      const db = getDB();
      const st = db.students[session.studentId];
      if(!st) return;
      const early = isEarlyGradeStudent(st);
      document.body.dataset.gradeBand = early ? 'early' : 'standard';
      document.getElementById('stu-xp').textContent = st.xp;
      document.getElementById('stu-ava').textContent = st.avatar || "🦊";
      document.getElementById('stu-greet').textContent = `Mabuhay, ${st.name}! 👋`;
      document.getElementById('stu-meta').textContent = `Baitang ${st.gradeLevel} • ${st.section}`;
      const lvl = levelOfXP(st.xp);
      const pct = xpPct(st.xp);
      document.getElementById('stu-level').textContent = lvl;
      document.getElementById('stu-xp-pct').textContent = pct + "%";
      document.getElementById('stu-xp-bar').style.width = pct + "%";

      const earlyZone = document.getElementById('grade12-dashboard');
      const standardWrap = document.getElementById('student-standard-sections');
      if(earlyZone) earlyZone.hidden = !early;
      if(standardWrap) standardWrap.hidden = early;

      if(early){
        renderGrade12Dashboard(db, st);
      } else {
        renderDaily(db, st);
        renderStudentProgress(db, st);
        renderUpcomingTasks(db, st);
        renderLeaderboard(db, st);
      }
      renderAvatars();
    }

    function openSubject(subject){
      if(session.role !== "student"){ notify("Student view only.", "warn"); return; }
      const db = getDB();
      const st = db.students[session.studentId];
      if(!st) return;
      const early = isEarlyGradeStudent(st);
      session.currentSubject = subject;
      const lessons = studentLessonsForSubject(db, st, subject);
      const theme = subjectTheme(subject);
      document.getElementById('lessons-title').textContent = `${subjectIcon(subject)} ${subject}`;
      document.getElementById('lessons-count').textContent = lessons.length;
      document.getElementById('lessons-sub').textContent = early
        ? `Tap ang card para maglaro at matuto sa ${subject}.`
        : `Mga aralin para sa Baitang ${st.gradeLevel} • ${st.section}`;
      const wrap = document.getElementById('lessons-wrap');
      wrap.innerHTML = lessons.length ? lessons.map(l => {
        const doneKey = `${l.gradeLevel}||${l.subject}||${l.lessonId}`;
        const done = !!st.completedLessons?.[doneKey];
        return `
          <div class="lesson-card ${early ? 'playful' : ''}" style="${early ? `--playful-accent:${theme.accent};--playful-bg:${theme.bg};` : ''}" onclick="openLesson('${l.gradeLevel}||${l.subject}||${l.lessonId}')">
            <div class="lesson-icon">${subjectIcon(l.subject)}</div>
            <div style="flex:1">
              <div style="font-weight:900">${safeText(l.title)}</div>
              <div class="muted">${safeText(l.duration)} • ${safeText(l.lessonId)}</div>
              ${early ? `<div class="kid-mini-progress" style="margin-top:10px"><span style="width:${done ? 100 : 35}%"></span></div>` : ''}
            </div>
            <div class="lesson-xp">${done ? '✅ Done' : `+${l.xp} XP`}</div>
          </div>`;
      }).join("") : `<div class="card"><div class="muted">Wala pang aralin dito.</div></div>`;
      go('screen-lessons');
    }
