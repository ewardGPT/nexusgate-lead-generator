#!/usr/bin/env python3
"""
n8n Workflow Import & Activate Script
Imports the outbound lead pipeline into n8n and activates it.
"""
import json
import sys
import urllib.request
import urllib.error

N8N_URL = "https://n8n.ervinward.com"
N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YjExZTVjNy0yOTE5LTQyNTMtODMyMy1kNWI2N2I4ODQ1MjkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDkxYjMxMzctNGEzNy00ZDEwLTk3NmEtYWJhMGYxYjdjYTRiIiwiaWF0IjoxNzc0NDcyMzYwfQ.KlYOXF2AE9uuH-AjnIjqDZlpWKKvcuc8iSsS2JN3UGA"

def api(method, path, data=None):
    url = f"{N8N_URL}{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("X-N8N-API-KEY", N8N_KEY)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"  ❌ HTTP {e.code}: {err_body[:200]}")
        return None

def main():
    workflow_file = sys.argv[1] if len(sys.argv) > 1 else "workflows/outbound-lead-pipeline.json"

    print(f"Loading {workflow_file}...")
    with open(workflow_file) as f:
        wf = json.load(f)

    # Clean metadata n8n regenerates
    wf.pop("id", None)
    wf.pop("versionId", None)
    wf.pop("triggerCount", None)
    wf.pop("updatedAt", None)
    wf["staticData"] = None
    wf["tags"] = [{"name": "outbound"}, {"name": "nexusgate"}]
    wf["active"] = False  # activate after import to set webhook IDs first

    name = wf.get("name", "unnamed")
    print(f"Importing workflow: {name}")

    result = api("POST", "/api/v1/workflows", wf)
    if not result:
        print("Failed to import workflow")
        sys.exit(1)

    wf_id = result.get("data", result).get("id")
    print(f"  ✅ Imported (id: {wf_id})")

    # Now activate it
    activate_data = {"active": True}
    result2 = api("PATCH", f"/api/v1/workflows/{wf_id}", activate_data)
    if result2:
        print(f"  ✅ Activated")
    else:
        print(f"  ⚠️ Could not auto-activate — activate manually in n8n UI")

    # List webhook URLs for this workflow
    result3 = api("GET", f"/api/v1/workflows/{wf_id}")
    if result3:
        wf_data = result3.get("data", result3)
        nodes = wf_data.get("nodes", [])
        webhooks = [n for n in nodes if n.get("type") == "n8n-nodes-base.webhook"]
        if webhooks:
            print(f"\n  Webhook nodes found:")
            for wh in webhooks:
                wh_id = wh.get("webhookId", "unknown")
                wh_name = wh.get("name", "unnamed")
                print(f"    • {wh_name} — webhookId: {wh_id}")
                print(f"      URL: {N8N_URL}/webhook/{wh_id}")
        else:
            print(f"\n  No webhook nodes in this workflow (it's schedule-triggered)")

    # List all active workflows
    print(f"\n=== Active Workflows ===")
    all_wfs = api("GET", "/api/v1/workflows")
    if all_wfs:
        workflows = all_wfs.get("data", [])
        for w in workflows:
            active = w.get("active", False)
            wname = w.get("name", "unnamed")
            wid = w.get("id", "?")
            print(f"  {'✅' if active else '  '} [{wid}] {wname}")

if __name__ == "__main__":
    main()
