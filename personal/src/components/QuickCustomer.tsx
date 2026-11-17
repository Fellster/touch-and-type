import { useState } from "react";
import { PhoneInput } from "../../../src/components/PhoneInput";
export default function QuickCustomer({
  busy,
  cancel,
  save,
}: {
  busy: boolean;
  cancel: () => void;
  save: (name: string, phone: string, email: string) => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState("");
  return (
    <form
      className="card quick-customer"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) void save(name.trim(), phone, email);
      }}
    >
      <input
        aria-label="Customer name"
        placeholder="Customer name *"
        autoFocus
        required
        maxLength={300}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <PhoneInput
        aria-label="Phone"
        placeholder="Phone"
        value={phone}
        onValueChange={setPhone}
      />
      <input
        type="email"
        aria-label="Email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="two-fields">
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={cancel}
        >
          Cancel
        </button>
        <button className="primary" disabled={busy || !name.trim()}>
          Review and save
        </button>
      </div>
    </form>
  );
}
