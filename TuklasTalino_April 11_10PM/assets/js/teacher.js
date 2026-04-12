// Teacher dashboard, group/task management, lesson authoring, student monitoring, and exports.

function renderTeacherDash(){
      const db = getDB();
      const t = db.teachers[session.teacherUsername];
      document.getElementById('t-name').textContent = t?.name || session.teacherUsername;
      const students = Object.values(db.students);
      const groups = Object.values(db.groups);
      const avgXP = students.length ? Math.round(students.reduce((a,b)=>a+b.xp,0)/students.length) : 0;
      const totalLogs7d = db.logs.filter(l => (Date.now() - new Date(l.at).getTime()) < 7*24*3600*1000).length;
      document.getElementById('t-stats').innerHTML = `
        <div class="card" style="box-shadow:none;background:var(--bg)"><div class="section-title">👨‍🎓 Students</div><div style="font-family:'Fredoka One',cursive;font-size:30px">${students.length}</div><div class="muted">Active accounts</div></div>
        <div class="card" style="box-shadow:none;background:var(--bg)"><div class="section-title">👥 Groups</div><div style="font-family:'Fredoka One',cursive;font-size:30px">${groups.length}</div><div class="muted">By section</div></div>
        <div class="card" style="box-shadow:none;background:var(--bg)"><div class="section-title">⚡ Avg XP</div><div style="font-family:'Fredoka One',cursive;font-size:30px">${avgXP}</div><div class="muted">Across students</div></div>
        <div class="card" style="box-shadow:none;background:var(--bg)"><div class="section-title">🧾 Logs (7d)</div><div style="font-family:'Fredoka One',cursive;font-size:30px">${totalLogs7d}</div><div class="muted">Engagement signals</div></div>`;
      renderTeacherGroupControls();
      renderTeacherGroups();
      renderTeacherStudentsFilters();
      renderTeacherStudents();
      renderTeacherLessons();
    }

    function renderTeacherGroupControls(){
      const db = getDB();
      const sel = document.getElementById('t-task-group');
      const groups = Object.values(db.groups).sort((a,b)=>a.name.localeCompare(b.name));
      sel.innerHTML = groups.length ? groups.map(g => `<option value="${g.id}">${escapeHTML(g.name)} (${escapeHTML(g.section)})</option>`).join("") : `<option value="">No groups yet</option>`;
    }

    function teacherCreateGroup(){
      const db = getDB();
      const name = (document.getElementById('t-group-name').value || "").trim();
      const section = (document.getElementById('t-group-section').value || "").trim();
      if(!name || !section){ notify("Ilagay ang group name at section.", "warn"); return; }
      const id = "GRP-" + Math.random().toString(16).slice(2);
      db.groups[id] = { id, name, section, createdBy: session.teacherUsername, memberIds: [], tasks: [], createdAt: nowISO() };
      saveDB(db);
      logEvent("teacher", session.teacherUsername, "group_created", { groupId:id, name, section });
      document.getElementById('t-group-name').value = "";
      document.getElementById('t-group-section').value = "";
      notify("Group created ✅");
      renderTeacherDash();
    }

    function teacherAddTask(){
      const db = getDB();
      const groupId = document.getElementById('t-task-group').value;
      const title = (document.getElementById('t-task-title').value || "").trim();
      const deadline = document.getElementById('t-task-deadline').value || "";
      const xp = Number(document.getElementById('t-task-xp').value || 0);
      if(!groupId || !db.groups[groupId]){ notify("Pumili ng group.", "warn"); return; }
      if(!title){ notify("Ilagay ang task title.", "warn"); return; }
      if(deadline && isNaN(new Date(deadline).getTime())){ notify("Invalid deadline date.", "bad"); return; }
      if(xp < 0 || xp > 500){ notify("XP must be 0..500.", "warn"); return; }
      const t = { id:"TSK-"+Math.random().toString(16).slice(2), title, deadline, xp, statusByStudent:{} };
      db.groups[groupId].tasks.push(t);
      saveDB(db);
      logEvent("teacher", session.teacherUsername, "task_added", { groupId, taskId:t.id, title, deadline, xp });
      document.getElementById('t-task-title').value = "";
      document.getElementById('t-task-deadline').value = "";
      document.getElementById('t-task-xp').value = "10";
      notify("Task added ✅");
      renderTeacherDash();
    }

    function renderTeacherGroups(){
      const db = getDB();
      const wrap = document.getElementById('t-groups-wrap');
      const groups = Object.values(db.groups).sort((a,b)=>a.name.localeCompare(b.name));
      if(!groups.length){ wrap.innerHTML = `<div class="muted">Wala pang groups. Gumawa muna sa “Create Group”.</div>`; return; }
      wrap.innerHTML = groups.map(g => {
        const prog = groupProgress(g);
        const members = g.memberIds.map(id => db.students[id]?.name || id).join(", ") || "—";
        const studentsInSection = Object.values(db.students).filter(s => s.section === g.section);
        const memberOptions = studentsInSection.map(s => {
          const checked = g.memberIds.includes(s.id) ? "checked" : "";
          return `<label style="display:flex;gap:10px;align-items:center;margin:6px 0;font-weight:900"><input type="checkbox" ${checked} onchange="teacherToggleMember('${g.id}','${s.id}', this.checked)"/><span>${escapeHTML(s.avatar||"👤")} ${escapeHTML(s.name)} (${s.id})</span></label>`;
        }).join("") || `<div class="muted">Walang students sa section na ito.</div>`;
        const tasks = g.tasks.map(t => {
          const completed = Object.values(t.statusByStudent||{}).filter(Boolean).length;
          const total = Math.max(1, g.memberIds.length);
          const pct = Math.round((completed/total)*100);
          return `<div class="card" style="box-shadow:none;background:var(--bg);margin:10px 0"><div class="row" style="justify-content:space-between"><div style="font-weight:900">${escapeHTML(t.title)}</div><div class="badge badge-warn">📌 ${pct}%</div></div><div class="muted">Deadline: ${t.deadline || "—"} • XP: +${t.xp} • Done: ${completed}/${total}</div><div class="divider"></div><button class="btn btn-danger btn-sm" onclick="teacherDeleteTask('${g.id}','${t.id}')">Delete Task</button></div>`;
        }).join("") || `<div class="muted">Wala pang tasks.</div>`;
        return `
          <div class="card" style="margin:10px 0">
            <div class="row" style="justify-content:space-between">
              <div>
                <div style="font-family:'Fredoka One',cursive;font-size:20px">👥 ${escapeHTML(g.name)}</div>
                <div class="muted">Section: ${escapeHTML(g.section)}</div>
                <div class="muted"><b>Members:</b> ${escapeHTML(members)}</div>
              </div>
              <div style="min-width:160px">
                <div class="muted" style="display:flex;justify-content:space-between"><span>Group Progress</span><span>${prog.pct}%</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width:${prog.pct}%"></div></div>
              </div>
            </div>
            <div class="divider"></div>
            <div class="grid grid-2">
              <div class="card" style="box-shadow:none;background:#fff">
                <div class="section-title">👨‍🎓 Members</div>
                <div class="muted">Tick students to include in this group.</div>
                <div class="divider"></div>
                <div style="max-height:260px;overflow:auto;padding-right:6px">${memberOptions}</div>
              </div>
              <div class="card" style="box-shadow:none;background:#fff">
                <div class="section-title">📋 Tasks</div>
                ${tasks}
              </div>
            </div>
            <div class="divider"></div>
            <button class="btn btn-danger btn-sm" onclick="teacherDeleteGroup('${g.id}')">Delete Group</button>
          </div>`;
      }).join("");
      renderTeacherGroupControls();
      renderStudentGroups();
    }

    function teacherToggleMember(groupId, studentId, checked){
      const db = getDB();
      const g = db.groups[groupId];
      if(!g) return;
      const set = new Set(g.memberIds);
      if(checked) set.add(studentId); else set.delete(studentId);
      g.memberIds = Array.from(set);
      saveDB(db);
      logEvent("teacher", session.teacherUsername, "group_member_updated", { groupId, studentId, checked });
      renderTeacherGroups();
    }

    function teacherDeleteGroup(groupId){
      const db = getDB();
      if(!db.groups[groupId]) return;
      if(!confirm("Delete this group?")) return;
      delete db.groups[groupId];
      saveDB(db);
      logEvent("teacher", session.teacherUsername, "group_deleted", { groupId });
      notify("Group deleted ✅");
      renderTeacherDash();
    }

    function teacherDeleteTask(groupId, taskId){
      const db = getDB();
      const g = db.groups[groupId];
      if(!g) return;
      if(!confirm("Delete this task?")) return;
      g.tasks = g.tasks.filter(t => t.id !== taskId);
      saveDB(db);
      logEvent("teacher", session.teacherUsername, "task_deleted", { groupId, taskId });
      notify("Task deleted ✅");
      renderTeacherDash();
    }

    
    function teacherCreateLesson(){
      const db = getDB();
      const gradeLevel = Number(document.getElementById('t-lesson-grade').value || 0);
      const subject = (document.getElementById('t-lesson-subject').value || "").trim();
      const title = (document.getElementById('t-lesson-title').value || "").trim();
      const xp = Number(document.getElementById('t-lesson-xp').value || 0);
      const instructions = (document.getElementById('t-lesson-instructions').value || "").trim();
      const passage = (document.getElementById('t-lesson-passage').value || "").trim();
      const speechTarget = (document.getElementById('t-lesson-speechTarget').value || "").trim();

      if(!(gradeLevel>=1 && gradeLevel<=6)){ notify("Invalid grade level.", "bad"); return; }
      if(!subject){ notify("Select a subject.", "warn"); return; }
      if(!title){ notify("Lesson title is required.", "warn"); return; }
      if(!passage){ notify("Passage/content is required.", "warn"); return; }
      if(xp < 0 || xp > 500){ notify("XP must be 0..500.", "warn"); return; }

      // Optional MCQ (only if filled)
      const q = (document.getElementById('t-mcq-q').value || "").trim();
      const a = (document.getElementById('t-mcq-a').value || "").trim();
      const b = (document.getElementById('t-mcq-b').value || "").trim();
      const c = (document.getElementById('t-mcq-c').value || "").trim();
      const d = (document.getElementById('t-mcq-d').value || "").trim();
      const correct = Number(document.getElementById('t-mcq-correct').value || 0);

      let activityItems = null;
      if(q && a && b && c && d){
        activityItems = [{ q, options:[a,b,c,d], correct }];
      }

      // Optional writing prompt
      const writingPrompt = (document.getElementById('t-writing-prompt').value || "").trim();
      const writingTask = writingPrompt ? { prompt: writingPrompt } : null;

      // Create a unique lessonId
      const lid = "TCH-" + Math.random().toString(16).slice(2,8).toUpperCase();
      const lessonId = `G${gradeLevel}-${subject.substring(0,3).toUpperCase()}-${lid}`;

      db.lessons.push({
        gradeLevel,
        subject,
        lessonId,
        title,
        duration: "10–20 minuto",
        xp: xp || 25,
        passage,
        instructions: instructions || "Basahin at sundin ang panuto.",
        activityItems,
        writingTask,
        oralTask: null,
        speechTarget: speechTarget || null,
        createdBy: session.teacherUsername,
        createdAt: nowISO()
      });

      saveDB(db);
      logEvent("teacher", session.teacherUsername, "lesson_created", { gradeLevel, subject, lessonId, title });

      // Clear fields
      document.getElementById('t-lesson-title').value = "";
      document.getElementById('t-lesson-instructions').value = "";
      document.getElementById('t-lesson-passage').value = "";
      document.getElementById('t-lesson-speechTarget').value = "";
      document.getElementById('t-mcq-q').value = "";
      document.getElementById('t-mcq-a').value = "";
      document.getElementById('t-mcq-b').value = "";
      document.getElementById('t-mcq-c').value = "";
      document.getElementById('t-mcq-d').value = "";
      document.getElementById('t-writing-prompt').value = "";

      notify("Lesson created ✅");
      renderTeacherLessons();
    }

    function renderTeacherLessons(){
      const db = getDB();
      const wrap = document.getElementById('t-lessons-wrap');
      if(!wrap) return;
      const lessons = db.lessons
        .filter(l => l.createdBy === session.teacherUsername)
        .slice()
        .sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")))
        .slice(0, 10);

      if(!lessons.length){
        wrap.innerHTML = "No teacher-created lessons yet.";
        return;
      }

      wrap.innerHTML = lessons.map(l => `
        <div class="lesson-card" style="cursor:default;border-color:var(--blue)">
          <div class="lesson-icon">${subjectIcon(l.subject)}</div>
          <div style="flex:1">
            <div style="font-weight:900">${escapeHTML(l.title)}</div>
            <div class="muted">Grade ${l.gradeLevel} • ${escapeHTML(l.subject)} • ${escapeHTML(l.lessonId)} • XP ${l.xp}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="openTeacherEditModal('${escapeHTML(l.lessonId)}')">View / Edit</button>
        </div>
      `).join("");
    }

    function openTeacherEditModal(lessonId){
      const db = getDB();
      const lesson = db.lessons.find(l => l.lessonId === lessonId);
      if(!lesson){ notify("Lesson not found.", "bad"); return; }
      if(lesson.createdBy !== session.teacherUsername){
        notify("Edit allowed for teacher-created lessons only.", "warn");
        return;
      }

      document.getElementById('t-edit-lessonId').value = lesson.lessonId;
      document.getElementById('t-edit-title').value = lesson.title || "";
      document.getElementById('t-edit-xp').value = lesson.xp ?? 25;
      document.getElementById('t-edit-instructions').value = lesson.instructions || "";
      document.getElementById('t-edit-passage').value = lesson.passage || "";
      document.getElementById('t-edit-speechTarget').value = lesson.speechTarget || "";

      const mcq = (lesson.activityItems && lesson.activityItems.length) ? lesson.activityItems[0] : null;
      document.getElementById('t-edit-mcq-q').value = mcq?.q || "";
      document.getElementById('t-edit-mcq-a').value = mcq?.options?.[0] || "";
      document.getElementById('t-edit-mcq-b').value = mcq?.options?.[1] || "";
      document.getElementById('t-edit-mcq-c').value = mcq?.options?.[2] || "";
      document.getElementById('t-edit-mcq-d').value = mcq?.options?.[3] || "";
      document.getElementById('t-edit-mcq-correct').value = String(mcq?.correct ?? 0);

      document.getElementById('t-edit-writing-prompt').value = lesson.writingTask?.prompt || "";

      document.getElementById('t-lesson-edit-modal').style.display = "flex";
    }

    function closeTeacherEditModal(){
      document.getElementById('t-lesson-edit-modal').style.display = "none";
    }

    function teacherSaveLessonEdits(){
      const db = getDB();
      const lessonId = document.getElementById('t-edit-lessonId').value;
      const lesson = db.lessons.find(l => l.lessonId === lessonId);
      if(!lesson){ notify("Lesson not found.", "bad"); return; }
      if(lesson.createdBy !== session.teacherUsername){
        notify("Edit allowed for teacher-created lessons only.", "warn");
        return;
      }

      const title = (document.getElementById('t-edit-title').value || "").trim();
      const xp = Number(document.getElementById('t-edit-xp').value || 0);
      const instructions = (document.getElementById('t-edit-instructions').value || "").trim();
      const passage = (document.getElementById('t-edit-passage').value || "").trim();
      const speechTarget = (document.getElementById('t-edit-speechTarget').value || "").trim();

      if(!title){ notify("Title is required.", "warn"); return; }
      if(!passage){ notify("Passage/content is required.", "warn"); return; }
      if(xp < 0 || xp > 500){ notify("XP must be 0..500.", "warn"); return; }

      const q = (document.getElementById('t-edit-mcq-q').value || "").trim();
      const a = (document.getElementById('t-edit-mcq-a').value || "").trim();
      const b = (document.getElementById('t-edit-mcq-b').value || "").trim();
      const c = (document.getElementById('t-edit-mcq-c').value || "").trim();
      const d = (document.getElementById('t-edit-mcq-d').value || "").trim();
      const correct = Number(document.getElementById('t-edit-mcq-correct').value || 0);

      let activityItems = null;
      if(q && a && b && c && d){
        activityItems = [{ q, options:[a,b,c,d], correct }];
      }

      const writingPrompt = (document.getElementById('t-edit-writing-prompt').value || "").trim();
      const writingTask = writingPrompt ? { prompt: writingPrompt } : null;

      lesson.title = title;
      lesson.xp = xp;
      lesson.instructions = instructions || "Basahin at sundin ang panuto.";
      lesson.passage = passage;
      lesson.speechTarget = speechTarget || null;
      lesson.activityItems = activityItems;
      lesson.writingTask = writingTask;
      lesson.updatedAt = nowISO();

      saveDB(db);
      logEvent("teacher", session.teacherUsername, "lesson_edited", { lessonId, title });
      notify("Lesson updated ✅");
      closeTeacherEditModal();
      renderTeacherLessons();
    }


function renderTeacherStudentsFilters(){
      const db = getDB();
      const sel = document.getElementById('t-filter-section');
      const sections = Array.from(new Set(Object.values(db.students).map(s => s.section))).sort();
      sel.innerHTML = `<option value="ALL">All Sections</option>` + sections.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
    }

    
function renderTeacherStudents(){
      const db = getDB();
      const filter = document.getElementById('t-filter-section').value || "ALL";
      const rows = Object.values(db.students)
        .filter(s => filter==="ALL" ? true : s.section === filter)
        .sort((a,b)=>b.xp-a.xp);

      const wrap = document.getElementById('t-students-table');
      wrap.innerHTML = rows.map(s => {
        const lessons = Object.keys(s.completedLessons||{}).length;
        const qavg = averageQuiz(s);
        const last = s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : "—";
        return `
          <div class="trow" style="cursor:pointer" onclick="openTeacherStudentDetail('${s.id}')">
            <div>
              ${escapeHTML(s.avatar||"👤")} ${escapeHTML(s.name)}
              <div class="muted">${s.id} • Baitang ${s.gradeLevel} • ${escapeHTML(s.section)}</div>
              <div style="margin-top:6px">
                <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openTeacherStudentDetail('${s.id}')">View details</button>
              </div>
            </div>
            <div>${s.xp}</div>
            <div>${lessons}</div>
            <div class="hide-sm">${qavg}%</div>
            <div class="hide-sm">${escapeHTML(last)}</div>
          </div>`;
      }).join("") || `<div class="trow"><div class="muted">No students.</div><div></div><div></div><div class="hide-sm"></div><div class="hide-sm"></div></div>`;
    }


    function exportStudentsCSV(){
      const db = getDB();
      const rows = Object.values(db.students).map(s => ({
        id: s.id, name: s.name, gradeLevel: s.gradeLevel, section: s.section,
        xp: s.xp, level: levelOfXP(s.xp),
        completedLessons: Object.keys(s.completedLessons||{}).length,
        quizAvg: averageQuiz(s), badges: (s.badges||[]).length,
        lastActiveAt: s.lastActiveAt || ""
      }));
      downloadCSV("students-report.csv", rows);
      logEvent("teacher", session.teacherUsername, "export_students_csv", { count: rows.length });
      notify("Students CSV exported ✅");
    }

    function exportLogsCSV(){
      const db = getDB();
      const rows = db.logs.map(l => ({ at: l.at, actorRole: l.actorRole, actorId: l.actorId, type: l.type, meta: JSON.stringify(l.meta||{}) }));
      downloadCSV("activity-logs.csv", rows);
      logEvent("teacher", session.teacherUsername, "export_logs_csv", { count: rows.length });
      notify("Logs CSV exported ✅");
    }


    function downloadSummaryReport(){
      const db = getDB();
      const teacher = db.teachers[session.teacherUsername];
      const createdAt = new Date().toLocaleString();
      const students = Object.values(db.students);
      const sections = Array.from(new Set(students.map(s => s.section))).sort();

      const sectionBlocks = sections.map(sec => {
        const group = students.filter(s => s.section === sec);
        const avgXP = group.length ? Math.round(group.reduce((a,b)=>a+b.xp,0)/group.length) : 0;
        const avgQuiz = group.length ? Math.round(group.reduce((a,b)=>a+averageQuiz(b),0)/group.length) : 0;
        const top = group.slice().sort((a,b)=>b.xp-a.xp).slice(0,5);
        return `
          <h3 style="margin:18px 0 6px">Section: ${escapeHTML(sec)}</h3>
          <p><b>Students:</b> ${group.length} • <b>Avg XP:</b> ${avgXP} • <b>Avg Quiz:</b> ${avgQuiz}%</p>
          <table style="width:100%;border-collapse:collapse;margin:10px 0">
            <tr style="background:#f6f6f6">
              <th style="text-align:left;padding:8px;border:1px solid #ddd">Top Students</th>
              <th style="text-align:left;padding:8px;border:1px solid #ddd">XP</th>
              <th style="text-align:left;padding:8px;border:1px solid #ddd">Completed Lessons</th>
            </tr>
            ${top.map(s => `
              <tr>
                <td style="padding:8px;border:1px solid #ddd">${escapeHTML(s.name)} (${s.id})</td>
                <td style="padding:8px;border:1px solid #ddd">${s.xp}</td>
                <td style="padding:8px;border:1px solid #ddd">${Object.keys(s.completedLessons||{}).length}</td>
              </tr>
            `).join("")}
          </table>
        `;
      }).join("");

      const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Tuklas Talino – Teacher Summary Report</title>
  <style>
    body{font-family:Arial, sans-serif; padding:24px; color:#222;}
    h1{margin:0 0 6px;}
    .muted{color:#666; font-size:12px;}
  
    body:not([data-role="student"]) .bottom-nav{display:none !important;}
  </style>
</head>
<body>
  <h1>Tuklas Talino – Summary Report</h1>
  <div class="muted">Generated: ${escapeHTML(createdAt)} • Teacher: ${escapeHTML(teacher?.name || session.teacherUsername || "—")}</div>
  <hr style="margin:16px 0"/>
  <h2>Overall</h2>
  <p><b>Total Students:</b> ${students.length}</p>
  ${sectionBlocks || "<p>No data.</p>"}
  <hr style="margin:16px 0"/>
  <div class="muted">Note: This report summarizes engagement signals (XP, completions, quiz averages) for monitoring purposes.</div>
</body>
</html>`;
      const blob = new Blob([html], {type:"text/html;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tuklas-talino-summary-report.html";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      logEvent("teacher", session.teacherUsername, "export_summary_report", { sections: sections.length, students: students.length });
      notify("Summary report downloaded ✅");
    }
    function downloadCSV(filename, rows){
      if(!rows.length){ notify("No data to export.", "warn"); return; }
      const cols = Object.keys(rows[0]);
      const csv = [cols.join(","), ...rows.map(r => cols.map(c => csvCell(r[c])).join(","))].join("\n");
      const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }

    function csvCell(v){
      const s = String(v ?? "");
      if(/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    }
