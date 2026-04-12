// Demo data and schema seeding for Tuklas Talino.

        function seedLessons(){
      /**
       * Demo lesson library (capstone-friendly).
       * Goal: each Grade 1–6 student sees at least ONE lesson per subject:
       * Pagbasa, Bokabularyo, Panitikan, Oral Comm, Pagsulat.
       */
      const lessons = [];

      const subjectDefs = {
        "Pagbasa": {
          icon: "📖",
          make: (g) => ({
            title: `Pagbasa ${g}: Maikling Kuwento`,
            duration: "10 minuto",
            passage: g<=2
              ? "Si Ana ay may bola. Pula ang bola. Masaya si Ana kapag naglalaro siya sa labas."
              : "Sa aming barangay, mahalaga ang pagtutulungan. Kapag may proyekto, sama-sama ang mga tao upang matapos ito nang maayos.",
            instructions: "Basahin ang teksto. Sagutin ang tanong.",
            activityItems: [
              {
                q: g<=2 ? "Ano ang kulay ng bola?" : "Ano ang pangunahing ideya ng teksto?",
                options: g<=2 ? ["Pula","Asul","Dilaw","Itim"] : ["Pagkain sa barangay","Pagtutulungan sa komunidad","Pag-alis sa lugar","Pagbili ng bagong gamit"],
                correct: g<=2 ? 0 : 1
              }
            ],
            speechTarget: g<=2 ? "Si Ana ay may bola." : "Mahalaga ang pagtutulungan."
          })
        },
        "Bokabularyo": {
          icon: "🔤",
          make: (g) => ({
            title: `Bokabularyo ${g}: Bahagi ng Pananalita`,
            duration: "10 minuto",
            passage: g<=2
              ? "Ang pangngalan ay pangalan ng tao, bagay, hayop, at lugar. Halimbawa: bata, lapis, aso, Maynila."
              : "Ang pangatnig ay salitang nag-uugnay ng mga salita o pangungusap. Halimbawa: at, ngunit, dahil, kaya.",
            instructions: "Piliin ang tamang sagot.",
            activityItems: [
              {
                q: g<=2 ? "Alin ang pangngalan?" : "Alin ang pangatnig?",
                options: g<=2 ? ["Tumakbo","Bahay","Masaya","Mabilis"] : ["Maganda","Dahil","Tahimik","Bilog"],
                correct: g<=2 ? 1 : 1
              }
            ],
            speechTarget: g<=2 ? "Ang pangngalan ay pangalan ng tao, bagay, hayop, at lugar." : "Ang pangatnig ay salitang nag-uugnay."
          })
        },
        "Panitikan": {
          icon: "📜",
          make: (g) => ({
            title: `Panitikan ${g}: Tula at Aral`,
            duration: "12 minuto",
            passage:
`Sa umaga'y liwanag, sa gabi'y bituin,
Sa puso'y pag-asa, sa isip ay giting.
Kapag may pagsubok, huwag bibitiw,
Pagpupunyagi ang susi sa tagumpay.`,
            instructions: "Basahin ang tula. Sagutin ang tanong.",
            activityItems: [
              {
                q: "Ano ang mensahe ng tula?",
                options: ["Huwag nang mag-aral","Sumuko sa pagsubok","Magpursige at huwag bibitiw","Umiwas sa tao"],
                correct: 2
              }
            ],
            speechTarget: "Pagpupunyagi ang susi sa tagumpay."
          })
        },
        "Oral Comm": {
          icon: "🎙️",
          make: (g) => ({
            title: `Oral Comm ${g}: Malinaw na Pagpapahayag`,
            duration: "10 minuto",
            passage: g<=2
              ? "Sabihin: \"Magandang araw po! Ako si _____.\""
              : "Magbigay ng maikling opinyon (30–45 segundo) tungkol sa: \"Bakit mahalaga ang disiplina?\"",
            instructions: "Pindutin ang Pakinggan, pagkatapos ay Magsalita. Ulitin nang malinaw.",
            oralTask: {
              prompts: g<=2
                ? ["Batiin ang guro.","Sabihin ang iyong pangalan.","Sabihin: Salamat po!"]
                : ["Ibigay ang opinyon mo.","Magbigay ng 2 dahilan.","Magbigay ng isang halimbawa."]
            },
            speechTarget: g<=2
              ? "Magandang araw po! Ako si _____."
              : "Mahalaga ang disiplina dahil nakatutulong ito sa pag-abot ng mga layunin."
          })
        },
        "Pagsulat": {
          icon: "✍️",
          make: (g) => ({
            title: `Pagsulat ${g}: Talatang Sanaysay`,
            duration: "15 minuto",
            passage: g<=2
              ? "Sumulat ng 3 pangungusap tungkol sa iyong paboritong pagkain."
              : "Sumulat ng 5–6 pangungusap na sumasagot: \"Paano mo maipapakita ang pagtutulungan sa bahay o paaralan?\"",
            instructions: "Sumulat nang malinaw. Gumamit ng halimbawa.",
            writingTask: {
              prompt: g<=2
                ? "Isulat ang 3 pangungusap. Banggitin kung bakit mo ito gusto."
                : "Isulat ang talata. Magbigay ng 2 halimbawa ng pagtutulungan."
            },
            speechTarget: g<=2 ? "Gusto ko ang ____ dahil ____." : "Pagtutulungan sa bahay o paaralan."
          })
        }
      };

      const subjects = ["Pagbasa","Bokabularyo","Panitikan","Oral Comm","Pagsulat"];
      for(let grade=1; grade<=6; grade++){
        for(const subject of subjects){
          const idPrefix = `G${grade}-${subjectDefs[subject].icon ? "" : ""}`;
          const baseId =
            subject==="Pagbasa" ? "PAG" :
            subject==="Bokabularyo" ? "WIK" :
            subject==="Panitikan" ? "PAN" :
            subject==="Oral Comm" ? "ORA" :
            "SUL";
          const lessonId = `G${grade}-${baseId}-01`;
          const xp = 18 + grade*4 + (subject==="Pagsulat" ? 6 : subject==="Oral Comm" ? 4 : 0);

          const body = subjectDefs[subject].make(grade);
          lessons.push({
            gradeLevel: grade,
            subject,
            lessonId,
            title: body.title,
            duration: body.duration,
            xp,
            passage: body.passage,
            instructions: body.instructions,
            activityItems: body.activityItems,
            writingTask: body.writingTask,
            oralTask: body.oralTask,
            speechTarget: body.speechTarget
          });
        }
      }

      return lessons;
    }

    function seedDB(){
      const lessons = seedLessons();
      const students = {
        "STU-2025-001": { id:"STU-2025-001", name:"Lia", gradeLevel:1, section:"Bulaklak", avatar:"🦋", xp:0, badges:[], completedLessons:{}, quizHistory:[], writingSubmissions:{}, speechAttempts:{}, createdAt:nowISO(), updatedAt:nowISO(), lastActiveAt:null , status:"active"},
        "STU-2025-002": { id:"STU-2025-002", name:"Noah", gradeLevel:2, section:"Bituin", avatar:"🐸", xp:0, badges:[], completedLessons:{}, quizHistory:[], writingSubmissions:{}, speechAttempts:{}, createdAt:nowISO(), updatedAt:nowISO(), lastActiveAt:null , status:"active"},
        "STU-2025-003": { id:"STU-2025-003", name:"Juan", gradeLevel:3, section:"Bulaklak", avatar:"🦊", xp:0, badges:[], completedLessons:{}, quizHistory:[], writingSubmissions:{}, speechAttempts:{}, createdAt:nowISO(), updatedAt:nowISO(), lastActiveAt:null , status:"active"},
        "STU-2025-004": { id:"STU-2025-004", name:"Maya", gradeLevel:4, section:"Matalino", avatar:"🐨", xp:0, badges:[], completedLessons:{}, quizHistory:[], writingSubmissions:{}, speechAttempts:{}, createdAt:nowISO(), updatedAt:nowISO(), lastActiveAt:null , status:"active"},
        "STU-2025-005": { id:"STU-2025-005", name:"Paolo", gradeLevel:5, section:"Masigasig", avatar:"🦁", xp:0, badges:[], completedLessons:{}, quizHistory:[], writingSubmissions:{}, speechAttempts:{}, createdAt:nowISO(), updatedAt:nowISO(), lastActiveAt:null , status:"active"},
        "STU-2025-006": { id:"STU-2025-006", name:"Aira", gradeLevel:6, section:"Mapanuri", avatar:"🐼", xp:0, badges:[], completedLessons:{}, quizHistory:[], writingSubmissions:{}, speechAttempts:{}, createdAt:nowISO(), updatedAt:nowISO(), lastActiveAt:null , status:"active"},
      };

      const teachers = {"teacher1": { username:"teacher1", name:"Teacher 1", password:"teach123", active:true, createdAt:nowISO() }};
      const admins = {"admin": { username:"admin", name:"System Admin", password:"admin123", createdAt:nowISO() }};
      const groups = {};
      const logs = [];
      const db = { version: SCHEMA_VERSION, lessons, students, teachers, admins, groups, logs };
      saveDB(db);
      return db;
    }
