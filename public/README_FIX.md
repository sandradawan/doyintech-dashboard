# Dashboard navigation fix

Sidebar now uses:
1. onclick="showPage('page')" on every nav item
2. Robust showPage() function
3. DOMContentLoaded init
4. try/catch so analytics errors cannot break navigation

Redeploy or hard-refresh (Ctrl+Shift+R) after pulling.
