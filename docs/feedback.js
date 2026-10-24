// Landing-page feedback form. Writes to the `feedback` collection in TechNav's
// Firestore project; firestore.rules allows creating entries and only admins can read them.
const SDK = 'https://www.gstatic.com/firebasejs/13.0.0';

const firebaseConfig = {
  apiKey: 'AIzaSyD9SUKfrA2fV0WMwfPzQpSo8aLq43carZQ',
  authDomain: 'technav-db7a8.firebaseapp.com',
  projectId: 'technav-db7a8',
  storageBucket: 'technav-db7a8.firebasestorage.app',
  messagingSenderId: '174572491167',
  appId: '1:174572491167:web:99a4ee0bf799a667782daa',
};

const form = document.getElementById('fb-form');
const thanks = document.getElementById('fb-thanks');
const error = document.getElementById('fb-error');
const submit = form.querySelector('button[type="submit"]');
const pills = [...form.querySelectorAll('.pill')];
let type = 'wrong';

const pick = (pill) => {
  type = pill.dataset.type;
  for (const p of pills) {
    p.classList.toggle('selected', p === pill);
    p.setAttribute('aria-pressed', String(p === pill));
  }
};
for (const pill of pills) pill.addEventListener('click', () => pick(pill));

// Load Firestore only when someone sends feedback, so the page itself stays light.
let database;
const getDatabase = () => database ??= Promise.all([
  import(`${SDK}/firebase-app.js`),
  import(`${SDK}/firebase-firestore.js`),
]).then(([app, firestore]) => ({ firestore, db: firestore.getFirestore(app.initializeApp(firebaseConfig)) }))
  .catch((cause) => { database = undefined; throw cause; });

const optional = (name) => form.elements[name].value.trim() || null;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  submit.disabled = true;
  try {
    const { firestore, db } = await getDatabase();
    await firestore.addDoc(firestore.collection(db, 'feedback'), {
      type,
      message: form.elements.message.value.trim(),
      from: optional('from'),
      to: optional('to'),
      email: optional('email'),
      createdAt: firestore.serverTimestamp(),
    });
    form.hidden = true;
    thanks.hidden = false;
    thanks.querySelector('button').focus();
  } catch (cause) {
    console.error(cause);
    error.textContent = "Sorry, that didn't send. Check your connection and try again, or open an issue on GitHub.";
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

document.getElementById('fb-again').addEventListener('click', () => {
  form.reset();
  pick(pills[0]);
  thanks.hidden = true;
  form.hidden = false;
  form.elements.message.focus();
});
