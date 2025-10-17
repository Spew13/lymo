// app.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Initialize Supabase client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* --------------------- ELEMENTS --------------------- */
const feedSection = document.getElementById('feedSection');
const subsSection = document.getElementById('subsSection');
const accountSection = document.getElementById('accountSection');

const feedBtn = document.getElementById('feedBtn');
const uploadBtn = document.getElementById('uploadBtn');
const subsBtn = document.getElementById('subsBtn');
const accountBtn = document.getElementById('accountBtn');

const uploadModal = document.getElementById('uploadModal');
const authModal = document.getElementById('authModal');

const confirmUploadBtn = document.getElementById('confirmUploadBtn');
const closeUploadModal = document.getElementById('closeUploadModal');

const signInBtn = document.getElementById('signInBtn');
const signUpBtn = document.getElementById('signUpBtn');
const closeAuthModal = document.getElementById('closeAuthModal');

const videoFeed = document.getElementById('videoFeed');
const subsFeed = document.getElementById('subsFeed');

const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authStatus = document.getElementById('authStatus');

const userEmailDisplay = document.getElementById('userEmail');
const accountEmail = document.getElementById('accountEmail');
const subscribedChannels = document.getElementById('subscribedChannels');

const videoTitle = document.getElementById('videoTitle');
const videoDescription = document.getElementById('videoDescription');
const videoFile = document.getElementById('videoFile');
const isPublic = document.getElementById('isPublic');

const videoCardTemplate = document.getElementById('videoCardTemplate');

const loadingOverlay = document.getElementById('loadingOverlay');

let currentUser = null;

/* --------------------- NAVIGATION --------------------- */
feedBtn.addEventListener('click', () => switchSection(feedSection));
uploadBtn.addEventListener('click', () => showUploadModal());
subsBtn.addEventListener('click', () => switchSection(subsSection));
accountBtn.addEventListener('click', () => switchSection(accountSection));

function switchSection(section) {
  [feedSection, subsSection, accountSection].forEach(s => s.classList.add('hidden'));
  section.classList.remove('hidden');
}

/* --------------------- MODALS --------------------- */
function showUploadModal() {
  if (!currentUser) {
    showAuthModal();
    return;
  }
  uploadModal.classList.add('visible');
}

function hideUploadModal() {
  uploadModal.classList.remove('visible');
}

function showAuthModal() {
  authModal.classList.add('visible');
}

function hideAuthModal() {
  authModal.classList.remove('visible');
}

closeUploadModal.addEventListener('click', hideUploadModal);
closeAuthModal.addEventListener('click', hideAuthModal);

/* --------------------- AUTH --------------------- */
async function signIn() {
  const { error, data } = await supabase.auth.signInWithPassword({
    email: authEmail.value,
    password: authPassword.value
  });
  if (error) {
    authStatus.textContent = error.message;
    return;
  }
  currentUser = data.user;
  userEmailDisplay.textContent = currentUser.email;
  document.getElementById('signOutBtn').classList.remove('hidden');
  hideAuthModal();
  loadFeed();
}

async function signUp() {
  const { error, data } = await supabase.auth.signUp({
    email: authEmail.value,
    password: authPassword.value
  });
  if (error) {
    authStatus.textContent = error.message;
    return;
  }
  authStatus.textContent = 'Sign-up successful! Please check your email to confirm.';
}

signInBtn.addEventListener('click', signIn);
signUpBtn.addEventListener('click', signUp);

/* --------------------- SIGN OUT --------------------- */
document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentUser = null;
  userEmailDisplay.textContent = '';
  document.getElementById('signOutBtn').classList.add('hidden');
});

/* --------------------- VIDEO UPLOAD --------------------- */
confirmUploadBtn.addEventListener('click', async () => {
  if (!currentUser) {
    alert('Sign in first!');
    return;
  }

  if (!videoFile.files[0] || !videoTitle.value) {
    alert('Please select a file and enter a title.');
    return;
  }

  loadingOverlay.classList.add('visible');

  const file = videoFile.files[0];
  const fileName = `${Date.now()}_${file.name}`;

  // Upload to Supabase Storage
  const { data: storageData, error: storageError } = await supabase
    .storage
    .from('videos')
    .upload(fileName, file);

  if (storageError) {
    alert('Upload failed: ' + storageError.message);
    loadingOverlay.classList.remove('visible');
    return;
  }

  // Insert metadata into database
  const { error: dbError } = await supabase.from('videos').insert([{
    title: videoTitle.value,
    description: videoDescription.value,
    channel: currentUser.email,
    video_path: fileName,
    views: 0,
    likes: 0,
    created_at: new Date()
  }]);

  if (dbError) {
    alert('Database insert failed: ' + dbError.message);
    loadingOverlay.classList.remove('visible');
    return;
  }

  hideUploadModal();
  videoTitle.value = '';
  videoDescription.value = '';
  videoFile.value = '';
  isPublic.checked = true;

  loadFeed();
  loadingOverlay.classList.remove('visible');
});

/* --------------------- LOAD FEED --------------------- */
async function loadFeed() {
  loadingOverlay.classList.add('visible');
  const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    loadingOverlay.classList.remove('visible');
    return;
  }

  videoFeed.innerHTML = '';
  data.forEach(video => {
    const clone = videoCardTemplate.content.cloneNode(true);
    const card = clone.querySelector('.video-card');
    card.querySelector('.video-player').src = supabase.storage.from('videos').getPublicUrl(video.video_path).data.publicUrl;
    card.querySelector('.video-title').textContent = video.title;
    card.querySelector('.video-channel').textContent = video.channel;
    card.querySelector('.views').textContent = `${video.views} views`;
    card.querySelector('.likes').textContent = `${video.likes} likes`;

    // Like button
    const likeBtn = clone.querySelector('.likeBtn');
    likeBtn.addEventListener('click', async () => {
      await supabase.from('videos').update({ likes: video.likes + 1 }).eq('id', video.id);
      loadFeed();
    });

    // Subscribe button
    const subBtn = clone.querySelector('.subscribeBtn');
    subBtn.addEventListener('click', async () => {
      await supabase.from('subscriptions').upsert({
        user_email: currentUser.email,
        channel_email: video.channel
      });
      alert(`Subscribed to ${video.channel}`);
    });

    videoFeed.appendChild(clone);
  });

  loadingOverlay.classList.remove('visible');
}

/* --------------------- INITIAL LOAD --------------------- */
async function init() {
  currentUser = supabase.auth.user();
  if (currentUser) {
    userEmailDisplay.textContent = currentUser.email;
    document.getElementById('signOutBtn').classList.remove('hidden');
  }
  loadFeed();
}

init();
