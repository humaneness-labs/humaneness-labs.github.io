/* Local native video, no autoplay, no third-party player or media preloading. */
(function () {
  "use strict";
  const inlinePlayers = document.querySelectorAll("[data-video-player]");
  const allVideos = () => Array.from(document.querySelectorAll("video"));
  const dialog = document.getElementById("ea-video-dialog");
  let returnFocus = null;

  function pauseOthers(current) {
    allVideos().forEach((video) => { if (video !== current) video.pause(); });
  }
  document.addEventListener("play", (event) => {
    if (event.target instanceof HTMLVideoElement) pauseOthers(event.target);
  }, true);

  inlinePlayers.forEach((player) => {
    const video = player.querySelector("video");
    const play = player.querySelector("[data-video-play]");
    const error = player.nextElementSibling;
    if (!video || !play) return;
    video.controls = false;
    play.hidden = false;

    function showError() {
      play.hidden = true;
      video.controls = true;
      if (error && error.matches("[data-video-error]")) error.hidden = false;
    }
    play.addEventListener("click", () => {
      pauseOthers(video);
      if (error && error.matches("[data-video-error]")) error.hidden = true;
      video.controls = true;
      play.hidden = true;
      if (video.ended) video.currentTime = 0;
      const promise = video.play();
      if (promise) promise.catch((error) => {
        // Switching samples or seeking can cancel a still-pending play request.
        if (error.name !== "AbortError") showError();
      });
      video.focus({ preventScroll: true });
    });
    video.addEventListener("play", () => { play.hidden = true; video.controls = true; });
    video.addEventListener("ended", () => {
      video.controls = false;
      play.hidden = false;
      play.querySelector(".ea-player__prompt").textContent = "Play again";
      play.setAttribute("aria-label", "Replay " + video.getAttribute("aria-label"));
    });
    video.addEventListener("error", showError);
  });

  if (dialog && typeof dialog.showModal === "function") {
    const video = dialog.querySelector("video");
    const error = dialog.querySelector("[data-video-error]");
    const title = dialog.querySelector("#ea-dialog-title");
    const description = dialog.querySelector("#ea-dialog-description");
    document.querySelectorAll("[data-gallery-video]").forEach((link) => {
      link.addEventListener("click", (event) => {
        // Modified clicks retain the useful direct-file fallback.
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        returnFocus = link;
        pauseOthers(video);
        title.textContent = link.dataset.title;
        description.textContent = link.dataset.description + " · Synthetic performance · Model estimates";
        dialog.querySelector("[data-dialog-voice]").textContent = link.dataset.voice;
        dialog.querySelector("[data-dialog-fallback]").href = link.href;
        error.hidden = true;
        video.poster = link.dataset.poster;
        video.src = link.href;
        dialog.showModal();
        document.body.classList.add("ea-dialog-open");
        const promise = video.play();
        if (promise) promise.catch((reason) => {
          if (reason.name !== "AbortError" && dialog.open) error.hidden = false;
        });
      });
    });
    dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      document.body.classList.remove("ea-dialog-open");
      if (returnFocus) returnFocus.focus({ preventScroll: true });
    });
    video.addEventListener("error", () => { if (dialog.open) error.hidden = false; });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) allVideos().forEach((video) => video.pause());
  });
}());
