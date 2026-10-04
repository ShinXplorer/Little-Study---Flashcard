import { firebaseConfig } from "./firebase-config.js";

const STORAGE_KEY = "little-study-decks-v1";
const colors = ["lavender", "peach", "sage", "butter", "blue"];
const homeView = document.querySelector("#home-view");
const studyView = document.querySelector("#study-view");
const deckGrid = document.querySelector("#deck-grid");
const emptyState = document.querySelector("#empty-state");
const toastElement = document.querySelector("#toast");
const deckDialog = document.querySelector("#deck-dialog");
const cardDialog = document.querySelector("#card-dialog");
const accountButton = document.querySelector("#account-button");
let decks = loadDecks();
let activeStorageKey = STORAGE_KEY;
let activeDeckId = null;
let activeCardIndex = 0;
let toastTimer;
let firebase = null;
let cloudReady = false;
let cloudQueue = Promise.resolve();
let currentUser = null;

function loadDecks(storageKey = STORAGE_KEY) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? saved.filter((deck) =>
      deck && typeof deck.id === "string" && typeof deck.name === "string" && Array.isArray(deck.cards)
    ) : [];
  } catch (error) {
    console.error("Could not load saved decks.", error);
    return [];
  }
}

function saveDecks() {
  try {
    localStorage.setItem(activeStorageKey, JSON.stringify(decks));
  } catch (error) {
    console.error("Could not save decks on this device.", error);
    showToast("Couldn’t save to this device. Check available storage.");
  }
  renderDecks();
  if (cloudReady && currentUser) queueCloudSync();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderDecks() {
  deckGrid.innerHTML = decks.map((deck, index) => {
    const color = colors[index % colors.length];
    const preview = deck.cards.slice(0, 2).map((card) =>
      `<span class="preview-line">${escapeHtml(card.front)}</span>`
    ).join("");
    const cardCount = deck.cards.length;
    return `<article class="deck-card ${color}">
      <div class="deck-card-top"><span class="deck-card-icon" aria-hidden="true">${["✳", "❋", "✿", "✦", "❀"][index % 5]}</span><button class="deck-more" type="button" data-action="delete-deck" data-deck-id="${escapeHtml(deck.id)}" aria-label="Delete ${escapeHtml(deck.name)}">+</button></div>
      <h3>${escapeHtml(deck.name)}</h3>
      <p class="deck-card-count">${cardCount} ${cardCount === 1 ? "card" : "cards"} <span>·</span> ${cardCount ? "Ready when you are" : "A blank little canvas"}</p>
      <div class="deck-preview">${preview || '<span class="preview-empty">Your first card goes here.</span>'}</div>
      <div class="deck-card-actions"><button class="deck-study-button" type="button" data-action="study-deck" data-deck-id="${escapeHtml(deck.id)}" ${cardCount ? "" : "disabled"}>${cardCount ? "Let’s study" : "Add your first card"} <span aria-hidden="true">→</span></button><button class="deck-add-button" type="button" data-action="add-card" data-deck-id="${escapeHtml(deck.id)}" aria-label="Add a card to ${escapeHtml(deck.name)}">＋</button></div>
    </article>`;
  }).join("");
  emptyState.hidden = decks.length > 0;
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("visible"), 3200);
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openDeckDialog() {
  document.querySelector("#deck-name").value = "";
  deckDialog.showModal();
  document.querySelector("#deck-name").focus();
}

function openCardDialog(deckId) {
  activeDeckId = deckId;
  const deck = decks.find((item) => item.id === deckId);
  if (!deck) return;
  document.querySelector("#card-dialog-deck").textContent = `A LITTLE MORE ABOUT ${deck.name.toUpperCase()}`;
  document.querySelector("#card-form").reset();
  cardDialog.showModal();
  document.querySelector("#card-front-input").focus();
}

function startStudy(deckId) {
  const deck = decks.find((item) => item.id === deckId);
  if (!deck || deck.cards.length === 0) return;
  activeDeckId = deckId;
  activeCardIndex = 0;
  homeView.hidden = true;
  studyView.hidden = false;
  document.querySelector("#study-deck-label").textContent = deck.name;
  renderStudyCard();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStudyCard() {
  const deck = decks.find((item) => item.id === activeDeckId);
  if (!deck || deck.cards.length === 0) {
    studyView.hidden = true;
    homeView.hidden = false;
    saveDecks();
    return;
  }
  activeCardIndex = (activeCardIndex + deck.cards.length) % deck.cards.length;
  const card = deck.cards[activeCardIndex];
  const flashcard = document.querySelector("#flashcard");
  flashcard.classList.remove("is-flipped");
  document.querySelector("#flashcard-front").textContent = card.front;
  document.querySelector("#flashcard-back").textContent = card.back;
  document.querySelector("#card-count").textContent = `${activeCardIndex + 1} / ${deck.cards.length}`;
  document.querySelector("#progress-fill").style.width = `${((activeCardIndex + 1) / deck.cards.length) * 100}%`;
  document.querySelector("#previous-card").disabled = deck.cards.length < 2;
  document.querySelector("#next-card").disabled = deck.cards.length < 2;
}

function getFirebaseErrorMessage(error) {
  const messages = {
    "auth/unauthorized-domain": "Add this site’s domain to Authorized domains in Firebase Authentication.",
    "auth/popup-closed-by-user": "The sign-in window was closed before you finished.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups and try again.",
  };
  return messages[error.code] || "Google sign-in didn’t work. Check your Firebase settings and try again.";
}

async function configureFirebase() {
  try {
    const [appSdk, authSdk, firestoreSdk] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
      import("firebase/firestore"),
    ]);
    const app = appSdk.initializeApp(firebaseConfig);
    const auth = authSdk.getAuth(app);
    firebase = { appSdk, authSdk, auth, firestoreSdk, db: firestoreSdk.getFirestore(app) };
    authSdk.onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      cloudReady = false;
      renderAccount(user);
      if (user) {
        activeStorageKey = `${STORAGE_KEY}:user:${user.uid}`;
        decks = loadDecks(activeStorageKey);
        renderDecks();
        setSaveStatus("Connecting your library…");
        try {
          await loadCloudDecks(user.uid);
          if (currentUser?.uid !== user.uid) return;
          cloudReady = true;
          setSaveStatus("Synced to your account");
          queueCloudSync();
        } catch (error) {
          console.error("Could not load your cloud library.", error);
          setSaveStatus("Cloud sync unavailable");
          showToast("Couldn’t load your cloud library. Check your connection and Firestore rules.");
        }
      } else {
        activeStorageKey = STORAGE_KEY;
        decks = loadDecks();
        renderDecks();
        setSaveStatus("Saved on this device");
      }
    });
  } catch (error) {
    console.error("Firebase could not be initialized.", error);
    setSaveStatus("Firebase couldn’t connect");
    showToast("Firebase could not connect. Check your setup and network.");
  }
}

function renderAccount(user) {
  accountButton.innerHTML = user
    ? `<span class="user-avatar">${escapeHtml((user.displayName || user.email || "U").slice(0, 1).toUpperCase())}</span><span>${escapeHtml(user.displayName || "Signed in")}</span><span class="account-chevron" aria-hidden="true">⌄</span>`
    : '<span class="google-g" aria-hidden="true">G</span><span id="account-label">Sign in with Google</span>';
  accountButton.setAttribute("aria-label", user ? "Sign out" : "Sign in with Google");
}

function setSaveStatus(message) {
  document.querySelector("#save-status").textContent = message;
}

async function loadCloudDecks(userId) {
  const { collection, getDocs } = firebase.firestoreSdk;
  const snapshot = await getDocs(collection(firebase.db, "users", userId, "decks"));
  if (currentUser?.uid !== userId) return;
  const remoteDecks = snapshot.docs.map((document) => ({ ...document.data(), id: document.id }));
  const merged = new Map();
  for (const deck of decks) merged.set(deck.id, deck);
  for (const deck of remoteDecks) merged.set(deck.id, deck);
  decks = [...merged.values()].filter((deck) =>
    typeof deck.name === "string" && Array.isArray(deck.cards)
  );
  try {
    localStorage.setItem(`${STORAGE_KEY}:user:${userId}`, JSON.stringify(decks));
  } catch (error) {
    console.error("Could not cache your cloud library locally.", error);
    showToast("Your cloud library loaded, but couldn’t be cached on this device.");
  }
  renderDecks();
}

function queueCloudSync() {
  if (!firebase || !currentUser) return;
  const userId = currentUser.uid;
  const snapshot = decks.map((deck) => ({ ...deck }));
  setSaveStatus("Syncing your library…");
  cloudQueue = cloudQueue.then(async () => {
    if (currentUser?.uid !== userId) return;
    const { collection, deleteDoc, doc, getDocs, setDoc } = firebase.firestoreSdk;
    const deckCollection = collection(firebase.db, "users", userId, "decks");
    const remoteSnapshot = await getDocs(deckCollection);
    const localIds = new Set(snapshot.map((deck) => deck.id));
    await Promise.all(remoteSnapshot.docs
      .filter((remoteDoc) => !localIds.has(remoteDoc.id))
      .map((remoteDoc) => deleteDoc(remoteDoc.ref)));
    await Promise.all(snapshot.map(({ id, ...data }) =>
      setDoc(doc(firebase.db, "users", userId, "decks", id), data)
    ));
    if (currentUser?.uid === userId) setSaveStatus("Synced to your account");
  }).catch((error) => {
    console.error("Could not sync your library.", error);
    if (currentUser?.uid === userId) {
      setSaveStatus("Cloud sync unavailable");
      showToast("Your changes are saved on this device, but cloud sync failed.");
    }
  });
}

document.querySelectorAll(".create-deck-trigger").forEach((button) => button.addEventListener("click", openDeckDialog));

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelector("#deck-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get("name").trim();
  if (!name) return;
  decks.unshift({ id: createId(), name, cards: [], createdAt: new Date().toISOString() });
  saveDecks();
  deckDialog.close();
  showToast("Your new deck is ready for its first card.");
});

document.querySelector("#card-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const deck = decks.find((item) => item.id === activeDeckId);
  if (!deck) return;
  deck.cards.push({
    id: createId(),
    front: String(formData.get("front")).trim(),
    back: String(formData.get("back")).trim(),
  });
  saveDecks();
  cardDialog.close();
  showToast("A new little thing to remember. Nice.");
});

deckGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, deckId } = button.dataset;
  if (action === "add-card") openCardDialog(deckId);
  if (action === "study-deck") startStudy(deckId);
  if (action === "delete-deck") {
    const deck = decks.find((item) => item.id === deckId);
    if (deck && window.confirm(`Delete “${deck.name}” and its cards?`)) {
      decks = decks.filter((item) => item.id !== deckId);
      saveDecks();
      showToast("Deck removed from your library.");
    }
  }
});

document.querySelector("#flashcard").addEventListener("click", (event) => {
  event.currentTarget.classList.toggle("is-flipped");
});

document.querySelector("#previous-card").addEventListener("click", () => {
  activeCardIndex -= 1;
  renderStudyCard();
});
document.querySelector("#next-card").addEventListener("click", () => {
  activeCardIndex += 1;
  renderStudyCard();
});
document.querySelector("#restart-study").addEventListener("click", () => {
  activeCardIndex = 0;
  renderStudyCard();
});

document.querySelector("#back-to-library").addEventListener("click", () => {
  studyView.hidden = true;
  homeView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

accountButton.addEventListener("click", async () => {
  if (!firebase) {
    showToast("To turn on Google sign-in, add your Firebase settings in src/firebase-config.js.");
    return;
  }
  try {
    if (currentUser) {
      await firebase.authSdk.signOut(firebase.auth);
      return;
    }
    const provider = new firebase.authSdk.GoogleAuthProvider();
    await firebase.authSdk.signInWithPopup(firebase.auth, provider);
  } catch (error) {
    console.error("Google sign-in failed.", error);
    showToast(getFirebaseErrorMessage(error));
  }
});

renderDecks();
configureFirebase();
