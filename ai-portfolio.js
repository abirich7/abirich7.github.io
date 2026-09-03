(() => {
  const videos = [
    {
      id: "rPrJmcNbTEM",
      start: 79,
      title: "I Compared India & America's Middle Class",
      topic: "AI POV & B-roll",
      credit: "Approx. 60% AI-generated POV shots and B-roll",
    },
    {
      id: "SD7wUD7LDj4",
      start: 0,
      title: "Harsh Reality of the Middle-Class Trap in India",
      topic: "AI visual storytelling",
      credit: "Opening minute and most B-roll AI-generated",
    },
    {
      id: "q62EvhFHC58",
      start: 0,
      title: "Dumbest Robbery Ever in the History of India",
      topic: "AI-generated B-roll",
      credit: "All B-roll AI-generated",
    },
  ];

  const videoUrl = (video) =>
    `https://www.youtube.com/watch?v=${video.id}${video.start ? `&t=${video.start}s` : ""}`;

  const makeCard = (video, index) => {
    const article = document.createElement("article");
    article.className = "video-card ai";
    article.innerHTML = `
      <a class="video-art" href="${videoUrl(video)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${video.title}">
        <img src="/${video.id}.jpg" alt="${video.title}" loading="lazy">
        <span class="video-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="play-button" aria-hidden="true">▶</span>
        <span class="art-label">AI-GENERATED VISUALS <span>↗</span></span>
      </a>
      <div class="card-meta"><span>${video.topic}</span><span>Keerthi</span></div>
      <h3><a href="${videoUrl(video)}" target="_blank" rel="noopener noreferrer">${video.title}</a></h3>
      <p class="credit">${video.credit}</p>`;
    return article;
  };

  const setFilter = (activeFilter, sections, buttons) => {
    sections.short.hidden = !["all", "short"].includes(activeFilter);
    sections.long.hidden = !["all", "long"].includes(activeFilter);
    sections.ai.hidden = !["all", "ai"].includes(activeFilter);
    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.filter === activeFilter));
    });
  };

  const initialise = () => {
    const workSection = document.querySelector("#work");
    if (!workSection || document.querySelector("#ai-generated")) return;

    const aiSection = document.createElement("section");
    aiSection.className = "video-group";
    aiSection.id = "ai-generated";
    aiSection.setAttribute("aria-labelledby", "ai-title");
    aiSection.innerHTML = `
      <div class="group-heading">
        <h3 id="ai-title">AI-Generated Visuals <span>/ 03 FILMS</span></h3>
        <p>Human-led edits. AI-built worlds.</p>
      </div>
      <p class="ai-note">Selected projects featuring AI-generated POV shots, B-roll and visual sequences, created with Runway, Kling AI and Google Flow, then shaped and integrated in Premiere Pro and After Effects.</p>
      <div class="ai-grid"></div>`;
    const aiGrid = aiSection.querySelector(".ai-grid");
    videos.forEach((video, index) => aiGrid.append(makeCard(video, index)));
    workSection.append(aiSection);

    const shortSection = document.querySelector("#shorts-title")?.closest(".video-group");
    const longSection = document.querySelector("#long-title")?.closest(".video-group");
    const filters = workSection.querySelector(".filters");

    if (shortSection && longSection && filters) {
      const filterOptions = [
        ["all", "All work", "13"],
        ["short", "Short form", "06"],
        ["long", "Long form", "04"],
        ["ai", "AI visuals", "03"],
      ];
      filters.replaceChildren();
      const buttons = filterOptions.map(([value, label, count]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.filter = value;
        button.setAttribute("aria-pressed", String(value === "all"));
        button.innerHTML = `${label}<span>${count}</span>`;
        filters.append(button);
        return button;
      });
      const sections = { short: shortSection, long: longSection, ai: aiSection };
      buttons.forEach((button) =>
        button.addEventListener("click", () => setFilter(button.dataset.filter, sections, buttons)),
      );
    }

    const workCount = document.querySelector('.site-header nav a[href="#work"] span');
    if (workCount) workCount.textContent = "13";

    const toolTags = document.querySelector(".tool-tags");
    ["Runway", "Kling AI", "Google Flow"].forEach((tool) => {
      if (toolTags && ![...toolTags.children].some((tag) => tag.textContent === tool)) {
        const tag = document.createElement("span");
        tag.textContent = tool;
        toolTags.append(tag);
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(initialise), { once: true });
  } else {
    requestAnimationFrame(initialise);
  }
})();
