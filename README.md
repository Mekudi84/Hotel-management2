# Bassey's Crib

A responsive Bassey's Crib hotel operations dashboard built with plain HTML, CSS, and JavaScript. It starts with no guest, room, or activity records; saved records are created only from submitted form inputs. Users can create an account and sign in from the browser. Account records, including salted PBKDF2 password hashes, are stored in `localStorage`; the signed-in session is stored in `sessionStorage` and ends when the browser tab is closed. This is browser-only authentication, not a secure substitute for a backend: accounts and data are limited to that browser and device, can be cleared by the user, and must not protect production or sensitive data. Password hashing requires the browser Web Crypto API, available on HTTPS or localhost. No backend, Node.js, build tool, or package installation is required. Open `index.html` in a browser. Google Fonts, Unsplash background photos, and the animated Three.js scene use CDNs, so those visual assets need an internet connection; reservation workflows still run locally without the 3D library.

## What's included

- Hotel metrics, arrivals, reservations, and recent house activity.
- Browser-only account signup, sign-in, and log out. New accounts are signed in automatically after signup.
- Reservation creation, editing, and deletion with form validation and browser-local persistence. Enter a guest name, optional email, room number, stay length, and arrival date; rate is optional.
- Reservation filters, guest and room search, one-click guest check-in, and per-row edit/delete actions.
- Separate 45/55 sticky workspace screens with photo headers, scrolling records, active navigation dots, and fade/scale reveals.
- A persistent NGN (₦), USD ($), EUR (€), and GBP (£) selector. Reservations retain their entered currency; totals include only matching records and do not apply exchange rates.
- Responsive navigation, a persistent light/dark theme toggle, a canvas arrival chart, and a floating Three.js scene with animated 3D hotel objects.
- A dark glass-and-gold visual theme with Bodoni Moda typography and dimensional hover/reveal motion, defined in `premium.css`.

## JavaScript fundamentals in context

- Variables, constants, strings, numbers, booleans, arrays, and objects: dashboard data and state in `app.js`.
- Functions, parameters, return values, scope, and template literals: rendering and event handlers.
- Conditionals, loops, and comparisons: reservation filters, status changes, and render logic.
- Array methods: `filter`, `find`, `map`, and `forEach` power the tables, counters, and activity feed.
- Objects, classes, constructors, methods, and `this`: `HotelManager` owns reservation behavior.
- The DOM and browser events: `querySelector`, delegated table clicks, form submission, resize, and dialogs.
- Forms and validation: required guest details, date, and stay length are validated before confirmation.
- Destructuring and spread syntax: activity rendering and reservation updates.
- Promises and `async` / `await`: simulated confirmation uses `try` / `catch` / `finally` for error handling.
- JSON, `localStorage`, and errors: reservations and salted password hashes persist in this browser with guarded load and save operations; the sign-in session uses `sessionStorage`.
- Date and internationalization: the dashboard date uses `Date` and `Intl.DateTimeFormat`.
- Canvas and animation: the arrival chart uses the 2D canvas API; the 3D scene uses Three.js.

Start with `initializeDashboard()` at the end of `app.js`, then follow its calls to see how data, DOM rendering, and browser events fit together.