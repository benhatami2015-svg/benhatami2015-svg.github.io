import { firebaseConfig, firebaseConfigured } from './firebase-config.js?v=2';

const $ = selector => document.querySelector(selector);
const authScreen = $('#authScreen');
const planner = $('#plannerApp');
const authForm = $('#authForm');
const emailInput = $('#authEmail');
const passwordInput = $('#authPassword');
const submitButton = $('#authSubmit');
const switchButton = $('#authSwitch');
const resendButton = $('#resendVerification');
const checkVerificationButton = $('#checkVerification');
const message = $('#authMessage');
const setupMessage = $('#authSetup');
let mode = 'signin';
let auth;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}

function setMode(nextMode) {
  mode = nextMode;
  const signingUp = mode === 'signup';
  $('#authTitle').innerHTML = signingUp ? 'Create your <em>account.</em>' : 'Welcome to <em>Daybook.</em>';
  $('#authIntro').textContent = signingUp
    ? 'Create an account with your email and a password. We’ll email you a verification link.'
    : 'Sign in to see your homework, or create an account to get started.';
  submitButton.innerHTML = signingUp ? 'Sign up <span>→</span>' : 'Sign in <span>→</span>';
  switchButton.innerHTML = signingUp ? 'Already have an account? <strong>Sign in</strong>' : 'New to Daybook? <strong>Sign up</strong>';
  passwordInput.autocomplete = signingUp ? 'new-password' : 'current-password';
  showMessage('');
}

switchButton.addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));

if (!firebaseConfigured) {
  setupMessage.hidden = false;
  setupMessage.textContent = 'Sign-up is not active yet. The site needs its Firebase connection finished before it can create accounts or send verification emails.';
  authForm.addEventListener('submit', event => {
    event.preventDefault();
    showMessage('Firebase setup is still needed before an account can be created or verified.', true);
  });
} else {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js');
  const {
    getAuth, createUserWithEmailAndPassword, sendEmailVerification,
    signInWithEmailAndPassword, signOut, onAuthStateChanged, reload
  } = await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js');
  auth = getAuth(initializeApp(firebaseConfig));

  authForm.addEventListener('submit', async event => {
    event.preventDefault();
    submitButton.disabled = true;
    showMessage(mode === 'signup' ? 'Creating your account…' : 'Signing in…');
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    try {
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const createdEmail = credential.user.email;
        await sendEmailVerification(credential.user);
        resendButton.hidden = false;
        checkVerificationButton.hidden = false;
        setMode('signin');
        showMessage(`We sent a verification link to ${createdEmail}. Don’t forget to check your junk mail too.`);
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await reload(credential.user);
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          resendButton.hidden = false;
          checkVerificationButton.hidden = false;
          showMessage(`Please verify ${credential.user.email}. We sent another link; check your junk mail too.`);
        }
      }
    } catch (error) {
      showMessage(friendlyError(error), true);
    } finally {
      submitButton.disabled = false;
    }
  });

  resendButton.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showMessage('Sign in with your email and password first, then you can resend the verification email.', true);
      return;
    }
    try {
      await reload(user);
      if (user.emailVerified) {
        await showPlanner(user);
        return;
      }
      await sendEmailVerification(user);
      showMessage(`A new verification link was sent to ${user.email}. Check your junk mail too.`);
    } catch (error) {
      showMessage(friendlyError(error), true);
    }
  });

  checkVerificationButton.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showMessage('Sign in first, then check your email again.', true);
      return;
    }
    try {
      await reload(user);
      if (user.emailVerified) await showPlanner(user);
      else showMessage('It is not verified yet. Check your inbox and junk mail, or resend the email.');
    } catch (error) {
      showMessage(friendlyError(error), true);
    }
  });

  window.daybookSignOut = () => signOut(auth);
  onAuthStateChanged(auth, async user => {
    if (!user) {
      authScreen.hidden = false;
      planner.hidden = true;
      window.daybookUser = null;
      window.daybookAuthEnabled = true;
      return;
    }
    try { await reload(user); } catch { /* the sign-in handler will show a useful error */ }
    if (!user.emailVerified) {
      authScreen.hidden = false;
      planner.hidden = true;
      resendButton.hidden = false;
      checkVerificationButton.hidden = false;
      if (!message.textContent) showMessage(`Please verify ${user.email}. Check your inbox and junk mail.`);
      return;
    }
    await showPlanner(user);
  });
}

async function showPlanner(user) {
    const previousUid = sessionStorage.getItem('daybook-auth-uid');
    if (previousUid && previousUid !== user.uid) {
      sessionStorage.setItem('daybook-auth-uid', user.uid);
      location.reload();
      return;
    }
    sessionStorage.setItem('daybook-auth-uid', user.uid);
    resendButton.hidden = true;
    checkVerificationButton.hidden = true;
    window.daybookUser = { uid: user.uid, email: user.email };
    window.daybookAuthEnabled = true;
    authScreen.hidden = true;
    planner.hidden = false;
    if (!window.daybookPlannerLoaded) {
      window.daybookPlannerLoaded = true;
      await import('./app.js');
    }
}

function friendlyError(error) {
  const messages = {
    'auth/email-already-in-use': 'There is already an account with that email. Try signing in.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'That email and password do not match an account.',
    'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a little and try again.',
    'auth/network-request-failed': 'Could not connect. Check your internet and try again.'
  };
  return messages[error?.code] || 'Something went wrong. Please check your details and try again.';
}

