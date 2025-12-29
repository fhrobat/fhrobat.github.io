<script>
document.querySelectorAll(".smooth-toggle").forEach(details => {
  const content = details.querySelector(".smooth-content");

  details.addEventListener("toggle", () => {
    if (details.open) {
      content.style.height = content.scrollHeight + "px";
      content.addEventListener("transitionend", function handler() {
        content.style.height = "auto";
        content.removeEventListener("transitionend", handler);
      });
    } else {
      content.style.height = content.scrollHeight + "px";
      requestAnimationFrame(() => {
        content.style.height = "0";
        content.style.opacity = "0";
      });
    }
  });
});
</script>
