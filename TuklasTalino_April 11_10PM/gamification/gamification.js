// XP, badge, and scoring helpers.

    function levelOfXP(xp){ return Math.floor(xp/150) + 1; }
    function xpPct(xp){ return Math.min(100, Math.round(((xp % 150) / 150) * 100)); }

    const BADGE_DEFS = [
      { id:"B1", name:"Unang Tagumpay", icon:"🏅", rule:(st)=>Object.keys(st.completedLessons).length>=1, desc:"Natapos ang unang aralin." },
      { id:"B2", name:"Masipag", icon:"🔥", rule:(st)=>st.xp>=150, desc:"Umabot ng 150 XP (Level 2)." },
      { id:"B3", name:"Batikang Mambabasa", icon:"📖", rule:(st)=>countCompletedBySubject(st,"Pagbasa")>=2, desc:"Nakumpleto ang 2 Pagbasa lessons." },
      { id:"B4", name:"Manunulat", icon:"✍️", rule:(st)=>Object.keys(st.writingSubmissions).length>=1, desc:"May naipasa na writing output." },
      { id:"B5", name:"Tagapagsalita", icon:"🎙️", rule:(st)=>Object.keys(st.speechAttempts).length>=1, desc:"May speech practice attempt." },
    ];

    function countCompletedBySubject(st, subject){
      return Object.values(st.completedLessons).filter(x => x.subject === subject).length;
    }

    function maybeUnlockBadges(st){
      const unlocked = new Set(st.badges || []);
      const newly = [];
      for(const b of BADGE_DEFS){
        if(unlocked.has(b.id)) continue;
        if(b.rule(st)){ unlocked.add(b.id); newly.push(b); }
      }
      st.badges = Array.from(unlocked);
      return newly;
    }

    function awardXP(studentId, amount, reason){
      const db = getDB();
      const st = db.students[studentId];
      if(!st) return;
      const beforeLevel = levelOfXP(st.xp);
      st.xp += Math.max(0, Number(amount)||0);
      st.updatedAt = nowISO(); st.lastActiveAt = nowISO();
      const newBadges = maybeUnlockBadges(st);
      saveDB(db);
      logEvent("student", st.id, "xp_awarded", { amount, reason });
      if(newBadges.length){
        newBadges.forEach(b => logEvent("student", st.id, "badge_unlocked", { badgeId:b.id, name:b.name }));
        notify(`New badge! ${newBadges[0].icon} ${newBadges[0].name}`);
      }
      const afterLevel = levelOfXP(st.xp);
      if(afterLevel > beforeLevel) notify(`Level Up! 🌟 Level ${afterLevel}`);
    }

    function completeLesson(){
      const db = getDB();
      const st = db.students[session.studentId];
      const lesson = findLessonByKey(db, session.currentLessonKey);
      if(!st || !lesson) return;
      const key = `${lesson.gradeLevel}||${lesson.subject}||${lesson.lessonId}`;
      if(st.completedLessons[key]){ notify("Completed na ito.", "warn"); return; }
      st.completedLessons[key] = { at: nowISO(), subject: lesson.subject, lessonId: lesson.lessonId, xp: lesson.xp };
      st.updatedAt = nowISO(); st.lastActiveAt = nowISO();
      saveDB(db);
      logEvent("student", st.id, "lesson_completed", { lessonId: lesson.lessonId, subject: lesson.subject, xp: lesson.xp });
      awardXP(st.id, lesson.xp, `Lesson completed: ${lesson.lessonId}`);
      notify(`Lesson completed! +${lesson.xp} XP 🎉`);
      renderStudentDash();
      go('screen-lessons');
    }

    function studentGroups(db, st){
      return Object.values(db.groups).filter(g => g.section === st.section && g.memberIds.includes(st.id));
    }

    function groupProgress(group){
      const total = group.tasks.length;
      if(total === 0) return { done:0, total:0, pct:0 };
      const memberCount = Math.max(1, group.memberIds.length);
      const totalStatuses = total * memberCount;
      let doneStatuses = 0;
      for(const task of group.tasks){
        for(const sid of group.memberIds){
          if(task.statusByStudent?.[sid]) doneStatuses++;
        }
      }
      const pct = Math.round((doneStatuses / totalStatuses) * 100);
      return { done: doneStatuses, total: totalStatuses, pct };
    }

    function renderStudentGroups(){
      const db = getDB();
      const st = db.students[session.studentId];
      const wrap = document.getElementById('stu-groups-wrap');
      if(!st || !wrap) return;
      const gs = studentGroups(db, st);
      if(!gs.length){
        wrap.innerHTML = `<div class="card"><div class="muted">Wala ka pang group. Hintayin ang teacher assignment.</div></div>`;
        return;
      }
      wrap.innerHTML = gs.map(g => {
        const prog = groupProgress(g);
        const tasksHtml = g.tasks.length ? g.tasks.map((t) => {
          const isDone = !!t.statusByStudent?.[st.id];
          const overdue = t.deadline && (new Date(t.deadline).getTime() < Date.now()) && !isDone;
          return `
            <div class="card" style="box-shadow:none;background:var(--bg);margin:10px 0">
              <div class="row" style="justify-content:space-between">
                <div style="font-weight:900">${escapeHTML(t.title)}</div>
                <div class="badge ${isDone?'badge-ok':overdue?'badge-bad':'badge-warn'}">${isDone?'✅ Done':overdue?'⏰ Overdue':'🕒 Pending'}</div>
              </div>
              <div class="muted">Deadline: ${t.deadline ? escapeHTML(t.deadline) : "—"} • Reward: +${t.xp} XP</div>
              <div class="divider"></div>
              <button class="btn ${isDone?'btn-outline':'btn-green'} btn-sm" ${isDone?'disabled':''} onclick="studentCompleteTask('${g.id}', '${t.id}')">Tapusin Task</button>
            </div>`;
        }).join("") : `<div class="muted">Wala pang tasks.</div>`;
        return `
          <div class="card">
            <div class="row" style="justify-content:space-between">
              <div>
                <div style="font-family:'Fredoka One',cursive;font-size:20px">👥 ${escapeHTML(g.name)}</div>
                <div class="muted">Section: ${escapeHTML(g.section)}</div>
              </div>
              <div style="min-width:140px">
                <div class="muted" style="display:flex;justify-content:space-between"><span>Progress</span><span>${prog.pct}%</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width:${prog.pct}%"></div></div>
              </div>
            </div>
            <div class="divider"></div>
            <div class="muted"><b>Members:</b> ${g.memberIds.map(id => escapeHTML(db.students[id]?.name || id)).join(", ")}</div>
            <div class="divider"></div>
            <div class="section-title">📋 Tasks</div>
            ${tasksHtml}
          </div>`;
      }).join("");
    }

    function studentCompleteTask(groupId, taskId){
      const db = getDB();
      const st = db.students[session.studentId];
      const g = db.groups[groupId];
      if(!st || !g) return;
      const task = g.tasks.find(x => x.id === taskId);
      if(!task) return;
      task.statusByStudent = task.statusByStudent || {};
      if(task.statusByStudent[st.id]){ notify("Done na ito.", "warn"); return; }
      task.statusByStudent[st.id] = true;
      saveDB(db);
      logEvent("student", st.id, "group_task_completed", { groupId, taskId, title: task.title, xp: task.xp });
      awardXP(st.id, task.xp || 0, `Group task: ${task.title}`);
      notify(`Task completed! +${task.xp} XP ✅`);
      renderStudentGroups();
      renderStudentDash();
    }

    function renderBadges(){
      const db = getDB();
      const st = db.students[session.studentId];
      if(!st) return;
      document.getElementById('badge-xp').textContent = st.xp;
      const owned = new Set(st.badges || []);
      const wrap = document.getElementById('badges-wrap');
      wrap.innerHTML = BADGE_DEFS.map(b => {
        const got = owned.has(b.id);
        return `
          <div class="lesson-card" style="cursor:default;border-color:${got?'var(--green)':'#DDD'};opacity:${got?1:.5}">
            <div class="lesson-icon">${b.icon}</div>
            <div style="flex:1">
              <div style="font-weight:900">${escapeHTML(b.name)} ${got?'✅':'🔒'}</div>
              <div class="muted">${escapeHTML(b.desc)}</div>
            </div>
            <div class="lesson-xp">${got?'Owned':'Locked'}</div>
          </div>`;
      }).join("");
    }

    function averageQuiz(st){
      const q = st.quizHistory || [];
      if(!q.length) return 0;
      const avg = q.reduce((a,b)=>a+(b.pct||0),0)/q.length;
      return Math.round(avg);
    }
