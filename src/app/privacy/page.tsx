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
            <td>
              <b>Only if you press &ldquo;Save to my account&rdquo;:</b> the answers in that worksheet. Otherwise worksheet
              answers stay in your browser and never reach us
            </td>
            <td>Letting you keep and reopen your answers on another device</td>
            <td>Your consent, given by pressing the button. You can remove the copy at any time</td>
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
            <td>
              Account activity: when you created your account, when you last signed in, when you last used the site, and how
              many times you have signed in (no IP address or device details)
            </td>
            <td>Security, and finding accounts that have been abandoned</td>
            <td>Legitimate interest (keeping the service tidy and safe)</td>
          </tr>
          <tr>
            <td>
              If you ask to reset your password: your email address, and a one-time reset link (we keep only a
              scrambled version of its code, which stops working after one hour or once used)
            </td>
            <td>Letting you back into your account</td>
            <td>Contract</td>
          </tr>
          <tr>
            <td>
              <b>Only if you opt in to social features:</b> reports you file about a post (the reason and any note) and
              thumbs up or down you give to learning resources
            </td>
            <td>Keeping the community safe, and telling us which resources help</td>
            <td>Your consent</td>
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
        They are off by default. If you turn them on, other people who have also opted in can see your answers,
        quizzes and votes by your first name. If you <b>stake</b> a topic (a claim of expertise you make yourself,
        and can withdraw), you may appear on that topic&rsquo;s experts list, by first name, among its top 10. If you stake a topic you may also suggest new nodes next to it (a name and a free web
        link); the AI checks the suggestion and, if it passes, publishes it to the shared map. A published node is part of the
        shared map, not your personal data: if you opt out or delete your account we delete the record linking it to you,
        but the node itself stays. Points
        are an internal measure used only to rank people; they are not shown to you or to others as numbers, and they
        are included if you ask for a copy of your data. You can turn social features off any time in{" "}
        <a href="/settings">Settings</a>. Doing so <b>deletes</b> your social data (it is not just hidden or
        anonymised).
      </p>

      <h2>3a. Reports, hiding and ratings</h2>
      <p>
        If you opt in you can report a post. Your report (the reason, any note, and that it came from you) is seen only by
        administrators. When three different people report the same post it is hidden automatically until an administrator
        decides; an administrator can also hide or restore a post. A hidden post is visible only to its author, flagged, and no
        longer counts toward holds, stakes or points. If a correction (for example the AI re-assessing an answer) shows that a
        hold or stake was granted by mistake, it is taken back, unless something else still supports it.
      </p>
      <p>
        If you hold a topic by passing a quiz or answering correctly, you can give a thumbs up or down to the learning resources
        that cover it. Your own vote is linked to your account and shown to you; administrators see only the totals for each
        resource, not who voted. Your votes are deleted if you opt out or delete your account.
      </p>

      <h2 id="ai">4. AI</h2>
      <p>
        When social features are used, an AI model creates quiz questions and judges whether answers are correct.
        To do that, the text of the relevant question and answer (not your name, email or account details) is sent
        to Mistral AI, a company based in France, which processes it for us under a data processing agreement and
        is not allowed to use it for its own purposes. We use Mistral&rsquo;s EU service; its own terms list any
        sub-processors it relies on. Judgements are automated and can be wrong. They only affect the
        social features (for example whether a node counts as held, or goes thin). They have no legal or similarly
        significant effect on you. Every automated judgement can be challenged from the screen where it is shown,
        and the challenge is re-assessed. Please do not put personal data about other people in your answers.
      </p>

      <h2>5. Who else sees your data</h2>
      <ul>
        <li>
          OVHcloud (OVH SAS, 2 rue Kellermann, 59100 Roubaix, France), which runs the virtual server and database for us
          in data centres in the European Union. It acts on our instructions under its data processing agreement.
        </li>
        <li>
          The email service that delivers password-reset emails (a processor). It sees your email address and the
          message.
        </li>
        <li>Mistral AI, as described in section 4.</li>
        <li>Other opted-in users, only what section 3 describes.</li>
        <li>Authorities, if the law requires it.</li>
      </ul>
      <p>We do not sell or rent data, and we do not share it for marketing.</p>

      <h2>6. How long we keep it</h2>
      <p>
        Account data, account activity, progress and any worksheets you saved to your account: until you delete your account (a saved worksheet can also be removed on its own). We use the activity dates to spot accounts that have been unused for a long time. Social data: until you opt out or delete your
        account. When you delete your account everything about you is erased from our live systems immediately.
        Password-reset links expire after one hour and are deleted with your account. Reports are kept until the post they
        concern, or your account, is deleted. If we keep backups, they may hold copies of deleted data until they are
        overwritten by the normal backup cycle.
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
