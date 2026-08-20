(function () {
  "use strict";

  function getConfig() {
    return {
      kycUrl: localStorage.getItem("dt_kyc_url") || "",
      propUrl: localStorage.getItem("dt_prop_url") || "",
      apiKey: localStorage.getItem("dt_api_key") || "dev-key-123"
    };
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = String(val);
  }

  function showPage(page) {
    var items = document.querySelectorAll(".nav-item");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove("active");
    }
    var active = document.querySelector('.nav-item[data-page="' + page + '"]');
    if (active) active.classList.add("active");

    var sections = document.querySelectorAll("main > section");
    for (var j = 0; j < sections.length; j++) {
      sections[j].classList.add("hidden");
    }
    var el = document.getElementById("page-" + page);
    if (!el) return;
    el.classList.remove("hidden");

    if (page === "overview") loadOverview();
    if (page === "analytics") loadAnalytics();
    if (page === "keys") loadUsage();
    if (page === "billing") loadPlans();
  }

  window.showPage = showPage;

  function saveSettings() {
    localStorage.setItem("dt_kyc_url", document.getElementById("kyc-url").value.trim());
    localStorage.setItem("dt_prop_url", document.getElementById("prop-url").value.trim());
    localStorage.setItem("dt_api_key", document.getElementById("api-key").value.trim());
    alert("Settings saved");
    loadOverview();
  }

  function callApi(base, path, body) {
    var c = getConfig();
    if (!base) return Promise.reject(new Error("Set API URL in Settings"));
    return fetch(base.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": c.apiKey },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); });
  }

  function runKyc() {
    var el = document.getElementById("kyc-result");
    el.style.display = "block";
    el.textContent = "Loading...";
    var body;
    try { body = JSON.parse(document.getElementById("kyc-body").value); }
    catch (e) { el.textContent = "Invalid JSON"; return; }
    var ep = document.getElementById("kyc-endpoint").value;
    callApi(getConfig().kycUrl, "/v1/kyc/" + ep, body)
      .then(function (data) { el.textContent = JSON.stringify(data, null, 2); loadOverview(); })
      .catch(function (e) { el.textContent = "Error: " + e.message; });
  }

  function runProperty() {
    var el = document.getElementById("prop-result");
    el.style.display = "block";
    el.textContent = "Loading...";
    var body;
    try { body = JSON.parse(document.getElementById("prop-body").value); }
    catch (e) { el.textContent = "Invalid JSON"; return; }
    var ep = document.getElementById("prop-endpoint").value;
    callApi(getConfig().propUrl, "/v1/property/" + ep, body)
      .then(function (data) { el.textContent = JSON.stringify(data, null, 2); })
      .catch(function (e) { el.textContent = "Error: " + e.message; });
  }

  function loadUsage() {
    var box = document.getElementById("usage-box");
    if (!box) return;
    var c = getConfig();
    if (!c.kycUrl) { box.textContent = "Set KYC URL in Settings"; return; }
    fetch(c.kycUrl.replace(/\/$/, "") + "/v1/keys/me", { headers: { "X-API-Key": c.apiKey } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          var d = data.data;
          box.textContent = "Plan: " + d.plan + "\nUsed: " + d.usedThisMonth + "/" + d.monthlyLimit + "\nRemaining: " + d.remaining;
          setText("stat-remaining", d.remaining);
          setText("stat-plan", d.plan);
          window._currentPlan = d.plan;
        } else box.textContent = data.error || "Failed";
      })
      .catch(function (e) { box.textContent = "Error: " + e.message; });
  }

  function loadAnalytics() {
    var c = getConfig();
    if (!c.kycUrl) return;
    Promise.all([
      fetch(c.kycUrl.replace(/\/$/, "") + "/v1/analytics/summary", { headers: { "X-API-Key": c.apiKey } }).then(function (r) { return r.json(); }),
      fetch(c.kycUrl.replace(/\/$/, "") + "/v1/analytics/events?limit=30", { headers: { "X-API-Key": c.apiKey } }).then(function (r) { return r.json(); })
    ]).then(function (results) {
      var sum = results[0];
      var evt = results[1];
      if (!sum.success) return;
      var d = sum.data;
      setText("stat-total", d.totalCalls);
      setText("stat-24h", d.last24h);
      setText("stat-ok", d.success);
      setText("stat-fail", d.failed);
      setText("stat-latency", d.avgLatencyMs + "ms");
      setText("a-total", d.totalCalls);
      setText("a-24", d.last24h);
      setText("a-lat", d.avgLatencyMs + "ms");
      setText("a-rate", d.totalCalls ? Math.round(d.success / d.totalCalls * 100) + "%" : "—");

      var epList = document.getElementById("endpoint-list");
      if (epList) {
        var eps = d.byEndpoint || {};
        var keys = Object.keys(eps);
        if (keys.length) {
          epList.textContent = keys.map(function (k) { return k + ": " + eps[k]; }).join("\n");
        } else {
          epList.textContent = "No data yet";
        }
      }

      var tbody = document.getElementById("events-body");
      if (tbody) {
        if (evt.success && evt.data && evt.data.length) {
          tbody.innerHTML = evt.data.map(function (e) {
            var cls = e.statusCode < 400 ? "status-ok" : "status-err";
            return "<tr><td>" + new Date(e.timestamp).toLocaleString() + "</td><td>" + e.endpoint +
              "</td><td class=\"" + cls + "\">" + e.statusCode + "</td><td>" + e.latencyMs + "ms</td></tr>";
          }).join("");
        } else {
          tbody.innerHTML = "<tr><td colspan=\"4\" style=\"color:var(--muted)\">No events yet</td></tr>";
        }
      }
    }).catch(function (e) { console.error(e); });
  }

  function createKey() {
    var name = document.getElementById("new-key-name").value.trim();
    var plan = document.getElementById("new-key-plan").value;
    var el = document.getElementById("key-result");
    el.style.display = "block";
    if (!name) { el.textContent = "Name required"; return; }
    var c = getConfig();
    if (!c.kycUrl) { el.textContent = "Set KYC URL"; return; }
    fetch(c.kycUrl.replace(/\/$/, "") + "/v1/keys/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, plan: plan })
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        el.textContent = JSON.stringify(data, null, 2);
        if (data.success && data.data && data.data.key) el.textContent += "\n\nCopy this key now";
      })
      .catch(function (e) { el.textContent = "Error: " + e.message; });
  }

  var PLAN_FEATURES = {
    starter: ["500 calls/mo"],
    growth: ["2000 calls/mo"],
    business: ["10000 calls/mo"],
    enterprise: ["Unlimited"]
  };

  function loadPlans() {
    var container = document.getElementById("plan-cards");
    if (!container) return;
    container.innerHTML = "Loading...";
    var c = getConfig();
    if (!c.kycUrl) {
      container.innerHTML = "<p style=\"color:var(--muted)\">Set KYC URL in Settings</p>";
      return;
    }
    fetch(c.kycUrl.replace(/\/$/, "") + "/v1/payment/plans")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success) throw new Error(data.error || "Failed");
        var cur = window._currentPlan || "growth";
        container.innerHTML = data.data.map(function (p) {
          var is = p.name === cur;
          var feats = (PLAN_FEATURES[p.name] || []).map(function (f) { return "<li>" + f + "</li>"; }).join("");
          return "<div class=\"plan-card" + (p.name === "growth" ? " featured" : "") + "\">" +
            (is ? "<span class=\"badge-current\">Current</span>" : "") +
            "<div class=\"plan-name\">" + p.name + "</div>" +
            "<div class=\"plan-price\">" + p.priceFormatted + " <span>/mo</span></div>" +
            "<ul>" + feats + "</ul>" +
            "<button class=\"" + (is ? "" : "amber") + "\" data-plan=\"" + p.name + "\" " +
            (is ? "disabled" : "") + ">" + (is ? "Current" : "Upgrade") + "</button></div>";
        }).join("");
        var btns = container.querySelectorAll("button[data-plan]");
        for (var i = 0; i < btns.length; i++) {
          btns[i].addEventListener("click", function (ev) {
            var plan = ev.target.getAttribute("data-plan");
            if (plan) startUpgrade(plan);
          });
        }
      })
      .catch(function (e) {
        container.innerHTML = "<p style=\"color:#ef4444\">" + e.message + "</p>";
      });
  }

  function startUpgrade(plan) {
    var email = document.getElementById("billing-email").value.trim();
    var el = document.getElementById("payment-result");
    if (!email) { el.textContent = "Enter email first"; return; }
    var c = getConfig();
    if (!c.kycUrl) { el.textContent = "Set KYC URL"; return; }
    el.textContent = "Initializing Paystack...";
    fetch(c.kycUrl.replace(/\/$/, "") + "/v1/payment/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": c.apiKey },
      body: JSON.stringify({ plan: plan, email: email })
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success) throw new Error(data.error || "Failed");
        localStorage.setItem("dt_pending_ref", data.data.reference);
        localStorage.setItem("dt_pending_plan", plan);
        window.location.href = data.data.authorization_url;
      })
      .catch(function (e) { el.textContent = "Error: " + e.message; });
  }

  function loadOverview() {
    loadUsage();
    loadAnalytics();
  }

  function initApp() {
    var kyc = document.getElementById("kyc-url");
    var prop = document.getElementById("prop-url");
    var key = document.getElementById("api-key");
    if (kyc) kyc.value = localStorage.getItem("dt_kyc_url") || "";
    if (prop) prop.value = localStorage.getItem("dt_prop_url") || "";
    if (key) key.value = localStorage.getItem("dt_api_key") || "dev-key-123";

    var navItems = document.querySelectorAll(".nav-item");
    for (var i = 0; i < navItems.length; i++) {
      navItems[i].addEventListener("click", function (e) {
        e.preventDefault();
        var page = this.getAttribute("data-page");
        if (page) showPage(page);
      });
    }

    function on(id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    }
    on("btn-save", saveSettings);
    on("btn-kyc", runKyc);
    on("btn-prop", runProperty);
    on("btn-create-key", createKey);
    on("btn-usage", loadUsage);
    on("btn-refresh-analytics", loadAnalytics);

    showPage("overview");
    console.log("DoyinTech Dashboard ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();
