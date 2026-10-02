# Bassey's Crib

A responsive Bassey's Crib hotel operations dashboard built with plain HTML, CSS, and JavaScript. It starts with no guest, room, or activity records; saved records are created only from submitted form inputs. The sign-in screen accepts any non-empty email and password and stores only a tab-session flag. This is a front-end gate, not real authentication; do not use it to protect production data. No backend, build tool, or package installation is required. Open `index.html` in a browser. Google Fonts, Unsplash background photos, and the animated Three.js scene use CDNs, so those visual assets need an internet connection; reservation workflows still run locally without the 3D library.

## What's included

- Hotel metrics, arrivals, reservations, and recent house activity.
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
- JSON, `localStorage`, and errors: reservations persist in this browser with guarded load and save operations.
- Date and internationalization: the dashboard date uses `Date` and `Intl.DateTimeFormat`.
- Canvas and animation: the arrival chart uses the 2D canvas API; the 3D scene uses Three.js.

Start with `initializeDashboard()` at the end of `app.js`, then follow its calls to see how data, DOM rendering, and browser events fit together.