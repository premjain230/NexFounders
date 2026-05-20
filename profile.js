// 🔥 Example email (later replace with Firebase user)
let userEmail = "premjain@gmail.com";

// 1. Get raw name from email
let rawName = userEmail.split("@")[0];

// 2. Username
let username = "@" + rawName.toLowerCase();

// 3. Format display name
function formatName(name){
    return name
        .replace(/[0-9]/g, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2");
}

// 4. Get initials
function getInitials(name){
    return name
        .split(/[^a-zA-Z]/)
        .filter(Boolean)
        .map(n => n[0])
        .join("")
        .toUpperCase();
}

// final values
let displayName = formatName(rawName);
let initials = getInitials(rawName);

// 5. Inject into HTML
document.querySelector(".name").innerText = displayName;
document.querySelector(".username").innerText = username;
document.querySelector(".profilepic").innerText = initials;