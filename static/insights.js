function readMore(){
    let dots = document.querySelector("#dots")
    let moreText = document.querySelector("#more")
    let btnTxt = document.querySelector("#button1")

    if (dots.style.display === "none"){
        dots.style.display = "inline";
        btnTxt.innerHTML = "Read more >>";
        moreText.style.display = "none";
    }
    else{
        dots.style.display = "none";
        btnTxt.innerHTML = "<< Read less";
        moreText.style.display = "inline";

    }
}


function readMore2(){

    let dots2 = document.querySelector("#dots2")
    let moreText2 = document.querySelector("#more2")
    let btnTxt2 = document.querySelector("#button2")

    if (dots2.style.display === "none"){
        dots2.style.display = "inline";
        btnTxt2.innerHTML = "Read more >>";
        moreText2.style.display = "none";
    }
    else{
        dots2.style.display = "none";
        btnTxt2.innerHTML = "<< Read less";
        moreText2.style.display = "inline";

    }
}