// Core app state, storage, navigation, auth, and shared utilities.

    const DB_KEY = "tt_db_v1";
    const SCHEMA_VERSION = 3;

    function nowISO(){ return new Date().toISOString(); }

    function loadDB(){
      const raw = localStorage.getItem(DB_KEY);
      if(!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }

    function saveDB(db){
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    }

    function getDB(){
      let db = loadDB();
      if(!db || !db.version) db = seedDB();
      if(db.version < SCHEMA_VERSION){
        db = migrateDB(db);
      }
      return db;
    }

    function migrateDB(db){
      // Why: users may already have old localStorage; we merge new lessons without wiping progress.
      // Also: subject name update (Wika -> Bokabularyo) to match Chapters 1–3 terminology.
      const SUBJECT_RENAMES = { "Wika": "Bokabularyo" };

      function renameSubject(s){ return SUBJECT_RENAMES[s] || s; }

      // 1) Rename subjects in existing lessons (if any old data remains)
      (db.lessons || []).forEach(l => { l.subject = renameSubject(l.subject); });

      // 2) Migrate completed lesson keys + stored subject labels so progress is preserved
      const students = db.students || {};
      Object.values(students).forEach(st => {
        if(!st.status) st.status = "active";
        // completedLessons key format: grade||subject||lessonId
        const oldComp = st.completedLessons || {};
        const newComp = {};
        Object.entries(oldComp).forEach(([k,v]) => {
          const parts = String(k).split("||");
          if(parts.length===3){
            const [g, subj, lid] = parts;
            const newSubj = renameSubject(subj);
            const nk = `${g}||${newSubj}||${lid}`;
            const nv = Object.assign({}, v, { subject: renameSubject(v?.subject) });
            newComp[nk] = nv;
          } else {
            newComp[k] = v;
          }
        });
        st.completedLessons = newComp;
        st.updatedAt = nowISO();
      });

      const fresh = seedLessons(); // latest bundled lessons
      const byKey = new Map();
      (db.lessons || []).forEach(l => byKey.set(`${l.gradeLevel}||${l.subject}||${l.lessonId}`, l));
      fresh.forEach(l => {
        const k = `${l.gradeLevel}||${l.subject}||${l.lessonId}`;
        if(!byKey.has(k)) byKey.set(k, l);
      });
      db.lessons = Array.from(byKey.values());
      db.version = SCHEMA_VERSION;
      saveDB(db);
      return db;
    }

    function logEvent(actorRole, actorId, type, meta){
      const db = getDB();
      db.logs.unshift({ id: "LOG-" + Math.random().toString(16).slice(2), at: nowISO(), actorRole, actorId, type, meta: meta || {} });
      saveDB(db);
    }

    const session = { role:null, studentId:null, teacherUsername:null, adminUsername:null, currentSubject:null, currentLessonKey:null, avatarPick:"🦊" };

    function go(screenId){
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const el = document.getElementById(screenId);
      if(el) el.classList.add('active');
    }

    function setRole(role){ document.body.dataset.role = role || ""; }

    function notify(msg, level="ok"){
      const wrap = document.getElementById('notif-wrap');
      const div = document.createElement('div');
      div.className = "notif " + (level==="warn"?"warn":level==="bad"?"bad":"");
      div.textContent = msg;
      wrap.appendChild(div);
      setTimeout(()=>div.remove(), 2600);
    }

function logout(){
      setRole("");
      document.body.dataset.gradeBand = "";
      stopAllAudio();
      if(typeof closeQuickQuiz === "function") closeQuickQuiz();
      session.role=null;
      session.studentId=null;
      session.teacherUsername=null;
      session.adminUsername=null;
      session.currentSubject=null;
      session.currentLessonKey=null;

      // Ensure no leftover student navigation is visible after logging out from teacher/admin.
      ["screen-student","screen-lessons","screen-lesson","screen-stu-groups","screen-stu-badges","screen-stu-profile"].forEach(id=>{
        const el=document.getElementById(id);
        if(el) el.classList.remove("active");
      });

      // Reset bottom nav state (safe even if not visible)
      const ids=["bnav-stu-home","bnav-stu-groups","bnav-stu-badges","bnav-stu-profile"];
      ids.forEach(id=>{
        const el=document.getElementById(id);
        if(el) el.classList.remove("active");
      });
      const homeBtn=document.getElementById("bnav-stu-home");
      if(homeBtn) homeBtn.classList.add("active");

      notify("Naka-logout na. 👋");
      go('screen-home');
    }


    function resetDemo(){
      localStorage.removeItem(DB_KEY);
      seedDB();
      notify("Demo data reset ✅");
      go('screen-home');
      renderAvatars();
    }

    const AVATARS = ["🦊","🐨","🐸","🦁","🐼","🦋","🐰","🐯","🦄","🐵","🐙","🐧"];

    function renderAvatars(){
      const grid = document.getElementById('stu-avatar-grid');
      const pgrid = document.getElementById('profile-avatar-grid');
      if(grid){
        grid.innerHTML = AVATARS.map(a => `<div class="avatar-circle ${a===session.avatarPick?'selected':''}" onclick="pickAvatar('${a}', 'student')">${a}</div>`).join("");
      }
      if(pgrid){
        const db = getDB();
        const st = session.studentId ? db.students[session.studentId] : null;
        const cur = st?.avatar || session.avatarPick;
        pgrid.innerHTML = AVATARS.map(a => `<div class="avatar-circle ${a===cur?'selected':''}" onclick="pickAvatar('${a}', 'profile')">${a}</div>`).join("");
      }
    }

    function pickAvatar(emoji, mode){
      session.avatarPick = emoji;
      if(mode === 'student') renderAvatars();
      if(mode === 'profile'){
        const db = getDB();
        const st = db.students[session.studentId];
        if(!st) return;
        st.avatar = emoji;
        st.updatedAt = nowISO();
        saveDB(db);
        logEvent("student", st.id, "avatar_changed", { avatar: emoji });
        notify("Avatar updated ✅");
        renderStudentDash();
        renderAvatars();
      }
    }

    function loginStudent(){
      const id = (document.getElementById('stu-id').value || "").trim();
      if(!id){ notify("Ilagay ang Student ID.", "warn"); return; }
      const db = getDB();
      const st = db.students[id];
      if(!st){ notify("Walang account na may ganitong ID.", "bad"); return; }
      if(st.archived){ notify("Archived ang account na ito. Makipag-ugnayan sa admin.", "bad"); return; }
      if(st.status==="archived"){ notify("Student account is archived. Please contact your teacher/admin.", "bad"); return; }

      session.role="student"; session.studentId=id;
      setRole("student");
      st.avatar = session.avatarPick || st.avatar;
      st.lastActiveAt = nowISO();
      st.updatedAt = nowISO();
      saveDB(db);
      logEvent("student", st.id, "login", {});
      notify(`Welcome, ${st.name}! 🎉`);
      go('screen-student');
      renderStudentDash();
    }

    function loginTeacher(){
      const u = (document.getElementById('t-username').value || "").trim();
      const p = (document.getElementById('t-password').value || "").trim();
      if(!u || !p){ notify("Ilagay ang username at password.", "warn"); return; }
      const db = getDB();
      const t = db.teachers[u];
      if(!t || t.password !== p){ notify("Invalid credentials.", "bad"); return; }
      if(t.inactive || t.archived){ notify("Archived/Inactive ang teacher account. Makipag-ugnayan sa admin.", "bad"); return; }
      if(t.active===false){ notify("Teacher account is inactive. Please contact admin.", "bad"); return; }

      session.role="teacher"; session.teacherUsername=u;
      setRole("teacher");
      logEvent("teacher", u, "login", {});
      notify(`Welcome, ${t.name}! 👩‍🏫`);
      go('screen-teacher');
      renderTeacherDash();
    }

    function loginAdmin(){
      const u = (document.getElementById('a-username').value || "").trim();
      const p = (document.getElementById('a-password').value || "").trim();
      if(!u || !p){ notify("Ilagay ang username at password.", "warn"); return; }
      const db = getDB();
      const a = db.admins[u];
      if(!a || a.password !== p){ notify("Invalid credentials.", "bad"); return; }
      session.role="admin"; session.adminUsername=u;
      setRole("admin");
      logEvent("admin", u, "login", {});
      notify(`Welcome, ${a.name}! 🛡️`);
      go('screen-admin');
      renderAdminDash();
    }

    function escapeHTML(s){ return String(s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
