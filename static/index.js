function redirectinsight(){
    location.href = "/insights";
}


function redirectphilosophy(){
     location.href = "/philosophy";
 }

function initProfilePhoto() {
    const wrap = document.querySelector(".profile-photo-wrap");
    const img = document.getElementById("profile");
    if (!wrap || !img) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        wrap.classList.add("is-loaded");
        return;
    }
    function markReady() {
        wrap.classList.add("is-loaded");
    }
    if (img.complete && img.naturalWidth > 0) {
        markReady();
        return;
    }
    img.addEventListener("load", markReady, { once: true });
    img.addEventListener("error", markReady, { once: true });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProfilePhoto);
} else {
    initProfilePhoto();
}