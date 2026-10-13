import LegalShell from "@/components/LegalShell";
import { CONTROLLER, MIN_AGE } from "@/lib/legal";

export const metadata = { title: "Privacy Policy — learnai" };

export default function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This explains what personal data learnai collects, why, who sees it, and your rights. It applies under the
        EU/UK General Data Protection Regulation (GDPR) and Italian data protection law.
      </p>

      <h2>1. Who is responsible (the data controller)</h2>
      <p>
        {CONTROLLER.name}, {CONTROLLER.address}. Contact for anything privacy-related:{" "}
        <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>. We reply within one month.
      </p>

      <h2>2. What we collect, and why</h2>
      <table className="legal-table">
        <thead>
          <tr><th>Data</th><th>Why</th><th>Legal basis</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Name, email, password (stored only as a one-way hash)</td>
            <td>Your account and signing in</td>
            <td>Contract (providing the service you asked for)</td>
          </tr>
          <tr>
            <td>Your ticked items and the nodes you hold, thin or have at the frontier</td>
            <td>Saving your progress and showing your map</td>
            <td>Contract</td>
          </tr>
          <tr>
            <td>Confirmation that you are {MIN_AGE}+, acceptance of the Terms and when</td>
            <td>Proof you met our age rule and agreed to the Terms</td>
            <td>Legitimate interest (running the service lawfully)</td>
          </tr>
          <tr>
            <td>
              <b>Only if you opt in to social features:</b> your quiz answers, questions and answers, votes, claims
              and positions, points, and the record of your consent
            </td>
            <td>Running the social features, ranking answers and showing experts</td>
            <td>Your consent. You can withdraw it at any time</td>
          </tr>
          <tr>
            <td>The login cookie</td>
            <td>Keeping you signed in</td>
            <td>Strictly necessary (see <a href="/cookies">Cookies</a>)</td>
          </tr>
        </tbody>
      </table>
      <p>
        We do not collect analytics, advertising identifiers or location. We do not sell your data and we do not
        use it for advertising or profiling for third parties.
      </p>

      <h2>3. Social features are optional</h2>
      <p>
        They are off by default. If you turn them on, other people who have also opted in can see your answers
        and, if you choose to appear as an expert, a display of your standing on a topic. Points are an internal
        measure used only to rank people; they are not shown to you or to others as numbers, and they are included
        if you ask for a copy of your data. You can turn social features off any time in{" "}
        <a href="/settings">Settings</a>. Doing so <b>deletes</b> your social data (it is not just hidden or
        anonymised).
      </p>

      <h2>4. AI</h2>
      <p>
        When social features are used, an AI model creates quiz questions and judges whether answers are correct.
        To do that, the text of the relevant question and answer (not your name, email or account details) is sent
        to an AI provider that processes it for us and is not allowed to use it for its own purposes. Our primary
        provider is Mistral AI, a company based in France, so that processing stays within the EU. We may also use
        OpenAI as an alternative provider; OpenAI is based in the United States, so when it is used your text is
        transferred outside the EU/UK under the European Commission&rsquo;s Standard Contractual Clauses set out in
        our data processing agreement with them. Judgements are automated and can be wrong. They only affect the
        social features (for example whether a node counts as held, or goes thin). They have no legal or similarly
        significant effect on you. Every automated judgement can be challenged from the screen where it is shown,
        and the challenge is re-assessed. Please do not put personal data about other people in your answers.
      </p>

      <h2>5. Who else sees your data</h2>
      <ul>
        <li>Our hosting provider, which stores the database on our behalf.</li>
        <li>The AI providers above, as described in section 4.</li>
        <li>Other opted-in users, only what section 3 describes.</li>
        <li>Authorities, if the law requires it.</li>
      </ul>
      <p>We do not sell or rent data, and we do not share it for marketing.</p>

      <h2>6. How long we keep it</h2>
      <p>
        Account data and progress: until you delete your account. Social data: until you opt out or delete your
        account. When you delete your account everything about you is erased from our live systems immediately.
        Encrypted backups may hold copies for a short time until they are overwritten by the normal backup cycle.
      </p>

      <h2>7. Your rights</h2>
      <p>
        You can ask to see your data, correct it, delete it, restrict or object to its use, receive it in a portable
        format, and withdraw consent at any time without affecting what happened before. In{" "}
        <a href="/settings">Settings</a> you can download your data and delete your account yourself. For anything
        else, write to <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>. You can also complain to the
        supervisory authority: the {CONTROLLER.authority}.
      </p>

      <h2>8. Age</h2>
      <p>
        learnai is for people aged {MIN_AGE} or over. We do not knowingly keep data about anyone younger. If you
        think a child has an account, tell us and we will delete it.
      </p>

      <h2>9. Security</h2>
      <p>
        Passwords are hashed. Connections use HTTPS. Access to the database is limited. No system is perfectly
        secure; if a breach puts your rights at risk we will notify you and the authority as the law requires.
      </p>

      <h2>10. Changes</h2>
      <p>If we change this policy in a way that matters, we will update the version above and tell you in the app.</p>
    </LegalShell>
  );
}
