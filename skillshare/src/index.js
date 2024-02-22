document
  .getElementById("learningPlanForm")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const data = {
      assignment_duration: document.getElementById("assignment_duration").value,
      topic: document.getElementById("topic").value,
      current_level: document.getElementById("current_level").value,
      duration_max: parseInt(document.getElementById("duration_max").value),
    };

    const loadingElement = document.getElementById("loading");
    const responseElement = document.getElementById("response");

    loadingElement.classList.remove("hidden");

    fetch("https://assasinp13.pythonanywhere.com/study-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.json())
      .then((data) => {
        loadingElement.classList.add("hidden");
        displayFinalAssignment(data.finalAssignment);
        displayStudyPlan(data.studyPlan);
      })
      .catch((error) => {
        loadingElement.classList.add("hidden");
        responseElement.innerHTML = `Error: ${error}`;
      });
  });

function displayFinalAssignment(finalAssignment) {
  const container = document.getElementById("finalAssignment");
  container.innerHTML = `
        <p>Assignment: ${finalAssignment.assignment}</p>
        <p>Resources:</p>
        <ul>
            ${finalAssignment.resources
              .map((resource) => `<li>${resource}</li>`)
              .join("")}
        </ul>
    `;
}

function displayStudyPlan(studyPlan) {
  const container = document.getElementById("studyPlan");
  container.innerHTML = studyPlan
    .map(
      (week) => `
        <div class="week-container">
            <h4>Week ${week.weekNumber}: ${week.topic}</h4>
            <p>Level: ${week.level}</p>
            <p>Assignment: ${week.week.assignment}</p>
            <p>Description: ${week.week.description}</p>
            ${week.week.day
              .map(
                (day) => `
                <div class="day-container">
                    <h5>Day Topic: ${day.topic}</h5>
                    <p>Resources:</p>
                    <ul>
                        ${day.resources
                          .map((resource) => `<li>${resource}</li>`)
                          .join("")}
                    </ul>
                </div>
            `
              )
              .join("")}
        </div>
    `
    )
    .join("");
}