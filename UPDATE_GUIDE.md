# Dark mode, invoice page and your own administrator

## Install this update

1. Stop Atlas in VS Code with Ctrl+C. Stop any other running Atlas API terminals as well.
2. Back up your existing project folder.
3. Extract the updated ZIP and copy its contents into your existing `atlas-logistics` folder, replacing the source files. Keep your existing `apps/api/data` folder. The ZIP contains no database and does not overwrite that folder.
4. Run `npm ci` in the project root.

## Replace the demo workspace with your own account

While Atlas is stopped, run:

```sh
npm run fresh-start
```

Enter your name, email, phone and a password of at least 12 characters, then repeat the password. Password typing is hidden; this is normal.

This command saves the complete previous database in `apps/api/data/backups/` (or a `backups` folder beside your custom `DB_PATH`). It then clears the demo users, shipments, invoices, payments, fleet, hubs and activity from the active database and creates only your new administrator. Company settings and rate cards are retained. The old data remains in the backup.

If any non-demo account already exists, the command stops without resetting anything. To preserve real records, sign in as the current admin, create your own ADMIN account in Team & access, sign out, sign in as the new administrator, then deactivate unwanted demo accounts. Reassign active driver deliveries before deactivating those drivers.

Start Atlas:

```sh
npm run dev
```

Sign in with the email and password you just entered. Add your staff in Team & access and your vehicles/hubs from their respective pages. Do not run `npm run setup` to add demo records again. Setup already refuses to seed a database that contains users.

A local setup command cannot change the copy on your computer until you download the update and run it there.

## Dark mode

Use the moon/sun button in the top bar. It is also available on sign-in and public tracking. Atlas remembers the selection in this browser. On first use, it follows the operating system's colour preference. Browser printing uses a light document style.

## View invoice

Each View invoice link now opens `/billing/<invoice-id>` immediately. This page shows the invoice summary, payment history, outstanding balance, print button and (for admin/finance) payment form. It has explicit loading, error and retry states. The invoice list no longer hides details below all its rows. Customers retain access only to their own invoices.

## Origin error fix (September 18)

This update automatically allows localhost and 127.0.0.1 on ports 5173, 5174 and 4000 in development, even if an older APP_ORIGINS shell setting exists. Production uses only the explicit APP_ORIGINS list. Spaces around configured entries are accepted.

Stop every running Atlas terminal with Ctrl+C, install this update as described above, then run `npm run dev`. Open the exact Local URL printed by Vite. If you use `npm start`, run `npm run build` first so the compiled API includes the fix. Do not run setup or fresh-start just to fix this error; your existing account and database can stay as they are.

If Vite moves past 5174, free the occupied development port or add the displayed origin to APP_ORIGINS before restarting the API. The error now includes the rejected address for diagnosis.
