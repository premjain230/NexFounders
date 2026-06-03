// 🎮 GAMISTAN CORE - XP, Level & Streak System
import { db, auth } from "./firebase.js";
import { doc, updateDoc, getDoc, increment, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚙️ XP & LEVEL SYSTEM
export function calcLevel(xp) {
  return Math.floor(xp / 200) + 1;
}

export async function addXP(userId, amount) {
  const userRef = doc(db, "users", userId);
  try {
    // Ensure user fields exist first
    const snap = await getDoc(userRef);
    if (!snap.exists() || !snap.data().xp) {
      await updateDoc(userRef, {
        xp: amount || 0,
        level: 1,
        streak: 0,
        lastLogin: new Date().toDateString()
      });
    } else {
      await updateDoc(userRef, {
        xp: increment(amount)
      });
    }
    console.log(`✅ Added ${amount} XP to user ${userId}`);
  } catch (error) {
    console.error("❌ Error adding XP:", error);
  }
}

// 🔥 STREAK SYSTEM
export async function updateStreak(userId) {
  const userRef = doc(db, "users", userId);
  
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    
    const user = snap.data();
    let today = new Date().toDateString();
    
    // Initialize if missing
    if (!user.lastLogin) {
      await updateDoc(userRef, {
        streak: 1,
        lastLogin: today
      });
      return;
    }

    if (user.lastLogin !== today) {
      let newStreak = (user.lastLogin === getYesterday()) ? (user.streak || 0) + 1 : 1;
      
      await updateDoc(userRef, {
        streak: newStreak,
        lastLogin: today
      });
      
      console.log(`🔥 Streak updated: ${newStreak} days`);
    }
  } catch (error) {
    console.error("❌ Error updating streak:", error);
  }
}

function getYesterday() {
  let d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toDateString();
}

// 🚀 DAILY LOGIN XP
export async function dailyLogin(userId) {
  await updateStreak(userId);
  await addXP(userId, 20);
  console.log("🎯 Daily login bonus: +20 XP");
}

// 🎯 POST TO FEED WITH XP
export async function shipPost(userId, postText, userName, userInitials) {
  if (!postText.trim()) {
    alert("Please write something before shipping! 🚀");
    return null;
  }

  try {
    // Add to feed collection with auto-generated ID
    const feedRef = collection(db, "feed");
    const postRef = await addDoc(feedRef, {
      text: postText,
      userId: userId,
      userName: userName,
      userInitials: userInitials,
      xp: 20,
      timestamp: new Date(),
      likes: 0,
      comments: []
    });

    // Add XP to user
    await addXP(userId, 20);
    
    console.log("🚀 Post shipped! +20 XP earned");
    return postRef.id;
  } catch (error) {
    console.error("❌ Error shipping post:", error);
    return null;
  }
}

// 📊 LOAD USER STATS
export async function loadUserStats(userId, displayFn) {
  const userRef = doc(db, "users", userId);
  
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const user = snap.data();
      const level = calcLevel(user.xp || 0);
      const xpPercent = ((user.xp || 0) % 200) / 2;
      
      displayFn({
        xp: user.xp || 0,
        level: level,
        streak: user.streak || 0,
        xpPercent: xpPercent
      });
    }
  } catch (error) {
    console.error("❌ Error loading stats:", error);
  }
}
