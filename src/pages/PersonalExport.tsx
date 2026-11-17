import { useState } from "react";
import { Link } from "react-router-dom";
import { exportPersonalCopy } from "@/lib/exportPersonal";
import { Button } from "@/components/ui/button";
export default function PersonalExport() {
  const [team, setTeam] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <main className="max-w-xl mx-auto px-5 py-8">
      <Link to="/settings">Back to Settings</Link>
      <h1 className="font-serif text-3xl mt-6">Copy to Noted Personal</h1>
      <p className="my-4">
        Download your own customer records, to-dos, notes, custom fields, and
        pictures/drawings as a Noted Personal backup. Nothing will be deleted or
        changed online.
      </p>
      <p className="my-4">
        Only records and attachments belonging to your signed-in account are
        copied. Customers owned by other members and their contributions are
        excluded. Stop editing records while you make this copy.
      </p>
      <label className="flex gap-3 my-4">
        <input
          type="checkbox"
          checked={team}
          disabled={busy}
          onChange={(e) => setTeam(e.target.checked)}
        />
        Include team customers where I am the recorded owner
      </label>
      <p className="text-sm my-4">
        The file contains private customer information and is not encrypted.
        Save it somewhere you control. You can restore it in Noted Personal
        without an internet connection.
      </p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("Downloading and verifying records and media…");
          try {
            const result = await exportPersonalCopy(team);
            const url = URL.createObjectURL(
              new Blob([result.text], { type: "application/json" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download =
              "Noted-Personal-Copy-" +
              new Date().toISOString().slice(0, 10) +
              ".json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            setMessage(
              "Copy prepared: " +
                result.counts.customers +
                " customers, " +
                result.counts.todos +
                " to-dos, " +
                result.counts.media +
                " pictures/drawings. Excluded: " +
                result.excludedCustomers +
                " team customers and " +
                result.excludedTodos +
                " to-dos linked to excluded customers. Keep the online app until you verify this copy in Noted Personal.",
            );
          } catch (e) {
            setMessage(
              e instanceof Error
                ? e.message
                : "Could not prepare the copy. Nothing was changed online.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing copy…" : "Download my copy"}
      </Button>
      <p className="my-4 whitespace-pre-wrap" role="status">
        {message}
      </p>
    </main>
  );
}
