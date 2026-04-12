// Admin account management, audit history, and teacher/student maintenance.

    function renderAdminDash(){ renderAdminStudents(); renderAdminTeachers(); renderAdminHistory(); }

    function adminAddStudent(){
      const db = getDB();
      const id = (document.getElementById('a-stu-id').value || "").trim();
      const name = (document.getElementById('a-stu-name').value || "").trim();
      const grade = Number(document.getElementById('a-stu-grade').value || 0);
      const section = (document.getElementById('a-stu-section').value || "").trim();
      if(!id || !name || !section || !(grade>=1 && grade<=6)){ notify("Complete fields: ID, name, grade(1-6), section.", "warn"); return; }
      if(db.students[id]){ notify("Student ID already exists.", "bad"); return; }
      db.students[id] = { id, name, gradeLevel: grade, section, avatar:"🦊", xp:0, badges:[], completedLessons:{}, quizHistory:[], writingSubmissions:{}, speechAttempts:{}, createdAt: nowISO(), updatedAt: nowISO(), lastActiveAt:null };
      saveDB(db);
      logEvent("admin", session.adminUsername, "student_created", { id, name, gradeLevel: grade, section });
      document.getElementById('a-stu-id').value = "";
      document.getElementById('a-stu-name').value = "";
      document.getElementById('a-stu-grade').value = "";
      document.getElementById('a-stu-section').value = "";
      notify("Student added ✅");
      renderAdminDash();
    }

    function adminAddTeacher(){
      const db = getDB();
      const u = (document.getElementById('a-t-username').value || "").trim();
      const name = (document.getElementById('a-t-name').value || "").trim();
      const p = (document.getElementById('a-t-password').value || "").trim();
      if(!u || !name || !p){ notify("Complete teacher fields.", "warn"); return; }
      if(db.teachers[u]){ notify("Teacher username exists.", "bad"); return; }
      if(p.length < 4){ notify("Password too short.", "warn"); return; }
      db.teachers[u] = { username:u, name, password:p, active:true, createdAt:nowISO() };
      saveDB(db);
      logEvent("admin", session.adminUsername, "teacher_created", { username:u, name });
      document.getElementById('a-t-username').value = "";
      document.getElementById('a-t-name').value = "";
      document.getElementById('a-t-password').value = "";
      notify("Teacher added ✅");
      renderAdminDash();
    }

function renderAdminStudents(){
      const db = getDB();
      const filter = (document.getElementById('a-stu-filter')?.value || 'ACTIVE');
      const wrap = document.getElementById('admin-students-wrap');
      let rows = Object.values(db.students).sort((a,b)=>a.id.localeCompare(b.id));
      rows = rows.filter(s => {
        const archived = !!s.archived;
        if(filter==='ALL') return true;
        if(filter==='ARCHIVED') return archived;
        return !archived;
      });

      wrap.innerHTML = rows.map(s => `
        <div class="lesson-card" style="cursor:default">
          <div class="lesson-icon">${s.avatar || "👤"}</div>
          <div style="flex:1">
            <div style="font-weight:900">${escapeHTML(s.name)} (${s.id})</div>
            <div class="muted">Baitang ${s.gradeLevel} • ${escapeHTML(s.section)} • XP ${s.xp} • Status: ${s.archived? "Archived":"Active"}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="adminResetStudent('${s.id}')">Reset Progress</button>
          ${s.archived
            ? `<button class="btn btn-green btn-sm" onclick="adminReactivateStudent('${s.id}')">Reactivate</button>`
            : `<button class="btn btn-yellow btn-sm" onclick="adminArchiveStudent('${s.id}')">Archive</button>`
          }
        </div>`).join("") || `<div class="muted">No students.</div>`;
    }

function renderAdminTeachers(){
      const db = getDB();
      const filter = (document.getElementById('a-t-filter')?.value || 'ACTIVE');
      const wrap = document.getElementById('admin-teachers-wrap');

      let rows = Object.values(db.teachers).sort((a,b)=>a.username.localeCompare(b.username));
      rows = rows.filter(t => {
        const isArchived = !!t.archived || !!t.inactive;
        if(filter==='ALL') return true;
        if(filter==='ARCHIVED' || filter==='INACTIVE') return isArchived;
        return !isArchived;
      });

      wrap.innerHTML = rows.map(t => {
        const isArchived = !!t.archived || !!t.inactive;
        const status = isArchived ? "Archived" : "Active";

        let actionBtn = "";
        if(t.username === "teacher1"){
          actionBtn = `<button class="btn btn-outline btn-sm" disabled title="Protected demo account">Protected</button>`;
        } else if(isArchived){
          actionBtn = `<button class="btn btn-green btn-sm" onclick="adminReactivateTeacher('${escapeHTML(t.username)}')">Reactivate</button>`;
        } else {
          actionBtn = `<button class="btn btn-yellow btn-sm" onclick="adminArchiveTeacher('${escapeHTML(t.username)}')">Archive</button>`;
        }

        return `
          <div class="lesson-card" style="cursor:default;border-color:var(--blue)">
            <div class="lesson-icon">👩‍🏫</div>
            <div style="flex:1">
              <div style="font-weight:900">${escapeHTML(t.name)} (${escapeHTML(t.username)})</div>
              <div class="muted">Created: ${escapeHTML(t.createdAt)} • Status: ${status}</div>
            </div>
            ${actionBtn}
          </div>`;
      }).join("") || `<div class="muted">No teachers.</div>`;
    }


    function adminResetStudent(studentId){
      const db = getDB();
      const s = db.students[studentId];
      if(!s) return;
      if(!confirm("Reset this student's progress (XP, badges, completed lessons, submissions)?")) return;
      s.xp=0; s.badges=[]; s.completedLessons={}; s.quizHistory=[]; s.writingSubmissions={}; s.speechAttempts={};
      s.updatedAt = nowISO();
      saveDB(db);
      logEvent("admin", session.adminUsername, "student_progress_reset", { studentId });
      notify("Student reset ✅");
      renderAdminDash();
      renderAdminHistory();
    }


    function adminArchiveStudent(studentId){
      const db=getDB();
      const s=db.students[studentId];
      if(!s) return;
      if(!confirm('Archive this student account? (Login will be disabled)')) return;
      s.archived=true;
      s.updatedAt=nowISO();
      saveDB(db);
      logEvent('admin', session.adminUsername, 'student_archived', { studentId });
      notify('Student archived ✅');
      renderAdminStudents();
      renderAdminHistory();
    }

    function adminReactivateStudent(studentId){
      const db=getDB();
      const s=db.students[studentId];
      if(!s) return;
      if(!confirm('Reactivate this student account?')) return;
      s.archived=false;
      s.updatedAt=nowISO();
      saveDB(db);
      logEvent('admin', session.adminUsername, 'student_reactivated', { studentId });
      notify('Student reactivated ✅');
      renderAdminStudents();
      renderAdminHistory();
    }


function adminSetStudentStatus(studentId, status){
      const db = getDB();
      const s = db.students[studentId];
      if(!s) return;

      const next = status === "active" ? "active" : "archived";
      const label = next === "active" ? "reactivate" : "archive";
      if(!confirm(`Confirm to ${label} this student account? (Records will be preserved.)`)) return;

      s.status = next;
      s.updatedAt = nowISO();
      saveDB(db);

      logEvent("admin", session.adminUsername, "student_status_updated", { studentId, status: next });
      notify(`Student status updated: ${next} ✅`);
      renderAdminDash();
    }

    function adminSetTeacherStatus(username, active){
      const db = getDB();
      const t = db.teachers[username];
      if(!t) return;
      if(username === "teacher1"){
        notify("Demo teacher1 is protected in this demo.", "warn");
        return;
      }

      const action = active ? "reactivate" : "deactivate";
      if(!confirm(`Confirm to ${action} this teacher account? (Records will be preserved.)`)) return;

      t.active = !!active;
      t.updatedAt = nowISO();
      saveDB(db);

      logEvent("admin", session.adminUsername, "teacher_status_updated", { username, active: !!active });
      notify(`Teacher status updated ✅`);
      renderAdminDash();
    }

    
    
    
    /***********************
     * Teacher: Student detail (monitoring)
     * Rationale: Chapters 1–3 require teacher monitoring with summarized reports.
     ***********************/
    function openTeacherStudentDetail(studentId){
      if(session.role !== "teacher"){
        notify("Teacher-only feature.", "warn");
        return;
      }
      const db = getDB();
      const s = db.students[studentId];
      if(!s){
        notify("Student not found.", "bad");
        return;
      }

      const modal = document.getElementById('t-student-modal');
      modal.classList.add('active');

      document.getElementById('t-student-modal-title').textContent =
        `${s.avatar || "👤"} ${s.name} (${s.id})`;

      document.getElementById('t-student-modal-sub').textContent =
        `Baitang ${s.gradeLevel} • ${escapeHTML(s.section)} • XP ${s.xp} • Last Active: ${s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : "—"}`;

      renderTeacherStudentDetailBody(db, s);
      logEvent("teacher", session.teacherUsername, "student_detail_viewed", { studentId });
    }

    function closeTeacherStudentDetail(){
      document.getElementById('t-student-modal')?.classList.remove('active');
    }

    function renderTeacherStudentDetailBody(db, s){
      const body = document.getElementById('t-student-modal-body');

      const completedCount = Object.keys(s.completedLessons || {}).length;
      const quizAvg = averageQuiz(s);
      const writingCount = Object.keys(s.writingSubmissions || {}).length;
      const speechLessonCount = Object.keys(s.speechAttempts || {}).length;

      const completedBySubject = ["Pagbasa","Bokabularyo","Panitikan","Oral Comm","Pagsulat"].map(subj => {
        const total = db.lessons.filter(l => l.gradeLevel === s.gradeLevel && l.subject === subj).length;
        const done = Object.values(s.completedLessons || {}).filter(x => x.subject === subj).length;
        const pct = total ? Math.round((done/total)*100) : 0;
        return { subj, done, total, pct };
      });

      const completedRecent = Object.values(s.completedLessons || {})
        .sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")))
        .slice(0, 12)
        .map(x => `<li style="margin:6px 0"><b>${escapeHTML(x.subject)}</b> • ${escapeHTML(x.lessonId)} • ${escapeHTML(x.at)}</li>`)
        .join("") || `<div class="muted">No completed lessons yet.</div>`;

      const writingList = Object.entries(s.writingSubmissions || {})
        .sort((a,b)=>String(b[1]?.at||"").localeCompare(String(a[1]?.at||"")))
        .slice(0, 8)
        .map(([lessonId, sub]) => `
          <div class="card" style="box-shadow:none;background:var(--bg);margin:10px 0">
            <div class="row" style="justify-content:space-between">
              <div style="font-weight:900">Lesson: ${escapeHTML(lessonId)}</div>
              <div class="badge ${sub.score>=70?'badge-ok':sub.score>=50?'badge-warn':'badge-bad'}">${sub.score}%</div>
            </div>
            <div class="muted">Submitted: ${escapeHTML(sub.at || "—")} • Label: ${escapeHTML(sub.label || "—")}</div>
          </div>
        `).join("") || `<div class="muted">No writing submissions yet.</div>`;

      const speechList = Object.entries(s.speechAttempts || {})
        .map(([lessonId, arr]) => {
          const best = (arr || []).reduce((m, it) => Math.max(m, Number(it.pct||0)), 0);
          const last = (arr || []).slice(-1)[0];
          return { lessonId, best, lastAt: last?.at || "", lastPct: Number(last?.pct||0) };
        })
        .sort((a,b)=>String(b.lastAt).localeCompare(String(a.lastAt)))
        .slice(0, 8)
        .map(x => `
          <div class="card" style="box-shadow:none;background:var(--bg);margin:10px 0">
            <div class="row" style="justify-content:space-between">
              <div style="font-weight:900">Lesson: ${escapeHTML(x.lessonId)}</div>
              <div class="badge ${x.best>=80?'badge-ok':x.best>=60?'badge-warn':'badge-bad'}">Best: ${x.best}%</div>
            </div>
            <div class="muted">Last attempt: ${escapeHTML(x.lastAt || "—")} • Last score: ${x.lastPct}%</div>
          </div>
        `).join("") || `<div class="muted">No speech attempts yet.</div>`;

      const groupBlocks = getStudentGroupStatusForTeacher(db, s);

      const recentLogs = (db.logs || [])
        .filter(l => l.actorRole === "student" && l.actorId === s.id)
        .slice(0, 12)
        .map(l => `
          <div class="card" style="box-shadow:none;background:var(--bg);margin:8px 0">
            <div style="font-weight:900">${escapeHTML(l.type)}</div>
            <div class="muted">${escapeHTML(l.at)}</div>
            <div class="muted">Meta: ${escapeHTML(JSON.stringify(l.meta || {}))}</div>
          </div>
        `).join("") || `<div class="muted">No recent logs.</div>`;

      const progCards = completedBySubject.map(x => `
        <div class="card" style="box-shadow:none;background:#fff">
          <div style="font-weight:900">${subjectIcon(x.subj)} ${escapeHTML(x.subj)}</div>
          <div class="muted">${x.done}/${x.total} completed • ${x.pct}%</div>
          <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${x.pct}%"></div></div>
        </div>
      `).join("");

      body.innerHTML = `
        <div class="grid grid-3">
          <div class="card" style="box-shadow:none;background:var(--bg)">
            <div class="section-title">📌 Summary</div>
            <div class="muted"><b>Completed lessons:</b> ${completedCount}</div>
            <div class="muted"><b>Quiz average:</b> ${quizAvg}%</div>
            <div class="muted"><b>Writing submissions:</b> ${writingCount}</div>
            <div class="muted"><b>Speech lessons attempted:</b> ${speechLessonCount}</div>
          </div>
          <div class="card" style="box-shadow:none;background:var(--bg)">
            <div class="section-title">⚡ XP</div>
            <div style="font-family:'Fredoka One',cursive;font-size:30px">${s.xp}</div>
            <div class="muted">Level ${levelOfXP(s.xp)} • Progress ${xpPct(s.xp)}%</div>
          </div>
          <div class="card" style="box-shadow:none;background:var(--bg)">
            <div class="section-title">🏅 Badges</div>
            <div class="muted">${(s.badges||[]).length} unlocked</div>
            <div class="muted" style="margin-top:6px">${(s.badges||[]).length ? escapeHTML((s.badges||[]).join(", ")) : "—"}</div>
          </div>
        </div>

        <div class="divider"></div>
        <div class="section-title">📊 Progress per Module</div>
        <div class="grid grid-3">${progCards}</div>

        <div class="divider"></div>
        <div class="section-title">👥 Group Participation</div>
        ${groupBlocks}

        <div class="divider"></div>
        <div class="section-title">✅ Recent Completed Lessons</div>
        <ul style="padding-left:18px">${completedRecent}</ul>

        <div class="divider"></div>
        <div class="section-title">✍️ Writing Submissions</div>
        ${writingList}

        <div class="divider"></div>
        <div class="section-title">🎙️ Speech Attempts</div>
        ${speechList}

        <div class="divider"></div>
        <div class="section-title">🧾 Recent Activity Logs</div>
        ${recentLogs}
      `;
    }

    function getStudentGroupStatusForTeacher(db, s){
      const groups = Object.values(db.groups || {}).filter(g => (g.memberIds || []).includes(s.id));
      if(!groups.length) return `<div class="muted">No group assignments for this student.</div>`;
      return groups.map(g => {
        const tasks = g.tasks || [];
        if(!tasks.length){
          return `<div class="card" style="box-shadow:none;background:var(--bg);margin:10px 0">
            <div style="font-weight:900">👥 ${escapeHTML(g.name)} (${escapeHTML(g.section)})</div>
            <div class="muted">No tasks yet.</div>
          </div>`;
        }
        const rows = tasks.map(t => {
          const done = !!t.statusByStudent?.[s.id];
          const overdue = t.deadline && (new Date(t.deadline).getTime() < Date.now()) && !done;
          const badge = done ? 'badge-ok' : overdue ? 'badge-bad' : 'badge-warn';
          const label = done ? 'Done' : overdue ? 'Overdue' : 'Pending';
          return `
            <div class="card" style="box-shadow:none;background:#fff;margin:10px 0">
              <div class="row" style="justify-content:space-between">
                <div style="font-weight:900">${escapeHTML(t.title)}</div>
                <div class="badge ${badge}">${done?'✅':'📌'} ${label}</div>
              </div>
              <div class="muted">Deadline: ${escapeHTML(t.deadline || "—")} • XP: +${t.xp}</div>
            </div>`;
        }).join("");
        return `<div class="card" style="box-shadow:none;background:var(--bg);margin:10px 0">
          <div style="font-weight:900">👥 ${escapeHTML(g.name)} (${escapeHTML(g.section)})</div>
          <div class="divider"></div>
          ${rows}
        </div>`;
      }).join("");
    }

    // Close modal when clicking backdrop
    document.addEventListener('click', (e) => {
      const backdrop = document.getElementById('t-student-modal');
      if(!backdrop || !backdrop.classList.contains('active')) return;
      if(e.target === backdrop) closeTeacherStudentDetail();
    });

    // Close modal with ESC
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') closeTeacherStudentDetail();
    });

function adminDeactivateTeacher(username){
      const db=getDB();
      const t=db.teachers[username];
      if(!t) return;
      if(!confirm('Deactivate this teacher account?')) return;
      t.inactive=true;
      saveDB(db);
      logEvent('admin', session.adminUsername, 'teacher_deactivated', { username });
      notify('Teacher deactivated ✅');
      renderAdminTeachers();
    }

    function adminArchiveTeacher(username){
      const db = getDB();
      const t = db.teachers[username];
      if(!t) return;
      if(!confirm("Archive this teacher account? (Login will be disabled)")) return;
      t.archived = true;
      t.inactive = true; // keep legacy aligned
      saveDB(db);
      logEvent("admin", session.adminUsername, "teacher_archived", { username });
      notify("Teacher archived ✅");
      renderAdminTeachers();
      renderAdminHistory();
    }

// Consolidated reactivate logic (deduplicated from the original single-file script).
function adminReactivateTeacher(username){
  const db = getDB();
  const t = db.teachers[username];
  if(!t) return;
  if(!confirm("Reactivate this teacher account?")) return;
  t.archived = false;
  t.inactive = false;
  saveDB(db);
  logEvent("admin", session.adminUsername, "teacher_reactivated", { username });
  notify("Teacher reactivated ✅");
  renderAdminTeachers();
  renderAdminHistory();
}

    function renderAdminHistory(){
      const db = getDB();
      const wrap = document.getElementById('admin-history-wrap');
      if(!wrap) return;

      const filter = (document.getElementById('a-hist-filter')?.value || 'ALL');

      const activeStudents = Object.values(db.students||{}).filter(s => !s.archived).length;
      const archivedStudents = Object.values(db.students||{}).filter(s => !!s.archived).length;
      const activeTeachers = Object.values(db.teachers||{}).filter(t => !(t.archived||t.inactive)).length;
      const archivedTeachers = Object.values(db.teachers||{}).filter(t => !!(t.archived||t.inactive)).length;

      const header = `
        <div class="card" style="box-shadow:none;background:var(--bg);margin-bottom:12px">
          <div class="row" style="justify-content:space-between">
            <div class="badge badge-ok">👨‍🎓 Active Students: ${activeStudents}</div>
            <div class="badge badge-warn">🗄️ Archived Students: ${archivedStudents}</div>
            <div class="badge badge-ok">👩‍🏫 Active Teachers: ${activeTeachers}</div>
            <div class="badge badge-warn">🗄️ Archived Teachers: ${archivedTeachers}</div>
          </div>
          <div class="muted" style="margin-top:8px">Includes logins, maintenance actions (archive/reactivate/reset), and basic audit events.</div>
        </div>
      `;

      const logs = (db.logs || []).slice();

      const keep = logs.filter(l => {
        if(filter === 'ALL') return true;

        if(filter === 'RESET'){
          return l.type === 'student_progress_reset';
        }

        if(filter === 'ACCOUNT'){
          return [
            'student_created','teacher_created',
            'student_archived','student_reactivated',
            'teacher_archived','teacher_reactivated',
            'teacher_deactivated','teacher_activated',
            'student_progress_reset'
          ].includes(l.type);
        }

        if(filter === 'LOGIN'){
          return l.type === 'login';
        }

        return true;
      }).slice(0, 40);

      const rows = keep.map(l => {
        const at = new Date(l.at).toLocaleString();
        const meta = l.meta || {};
        const who = l.actorId || meta.studentId || meta.username || '';
        const role = l.actorRole || '';
        return `
          <div class="lesson-card" style="cursor:default;border-color:var(--purple)">
            <div class="lesson-icon">🧾</div>
            <div style="flex:1">
              <div style="font-weight:900">${escapeHTML(role)} • ${escapeHTML(l.type)}</div>
              <div class="muted">${escapeHTML(at)} • ${escapeHTML(who)} • ${escapeHTML(JSON.stringify(meta))}</div>
            </div>
          </div>
        `;
      }).join("");

      wrap.innerHTML = header + (rows || `<div class="muted">No history yet.</div>`);
    }
