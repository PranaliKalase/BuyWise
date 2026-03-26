async function main() {
  try {
    const res = await fetch('http://localhost:8000/api/moderate/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: "Testing", description: "testing", category: "test" })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch(e) {
    console.error("Fetch failed:", e);
  }
}
main();
