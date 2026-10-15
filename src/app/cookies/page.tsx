import LegalShell from "@/components/LegalShell";

export const metadata = { title: "Cookies — learnai" };

export default function Cookies() {
  return (
    <LegalShell title="Cookies, in plain English">
      <p>
        <b>We use one small cookie, and it does one job: it remembers that you are signed in.</b>
      </p>
      <p>
        Without it, the site would forget who you are every time you click a link. That is all it is for. It is
        called <code>learnai_session</code>. It is set when you sign in or create an account, it lasts up to 30
        days, and it is removed when you sign out.
      </p>
      <h2>What we do not do</h2>
      <ul>
        <li>No tracking. We do not follow you around this site or any other.</li>
        <li>No advertising cookies. No analytics cookies. No social-media widgets.</li>
        <li>We never sell or share your information with anyone for marketing. Ever.</li>
      </ul>
      <h2>Do I have to click &ldquo;accept&rdquo;?</h2>
      <p>
        No. The law lets sites use cookies that are strictly needed to make the service work without asking first.
        That is the only kind we use, so there is nothing to accept or refuse. You see a short notice once, you
        dismiss it, and it does not come back. To remember that you dismissed it, your browser keeps a note on your
        own device (not a cookie, and it never leaves your device). Likewise, if you use a worksheet on an exercise,
        what you type is kept in your browser on your own device so it is there when you come back. It is never sent to
        us, and clearing your browser data removes it.
      </p>
      <h2>Can I opt out?</h2>
      <p>
        You can block or delete cookies in your browser settings at any time. If you do, you will simply be signed
        out and the site will not be able to keep you signed in. Reading the programme still works without an
        account.
      </p>
      <h2>If this changes</h2>
      <p>
        If we ever add a cookie that is not strictly needed, we will ask for your permission first, and update this
        page.
      </p>
    </LegalShell>
  );
}
