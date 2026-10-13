import LegalShell from "@/components/LegalShell";
import { CONTROLLER, MIN_AGE } from "@/lib/legal";

export const metadata = { title: "Terms — learnai" };

export default function Terms() {
  return (
    <LegalShell title="Terms of Use">
      <p>
        learnai is run by {CONTROLLER.name}, {CONTROLLER.address} (&ldquo;we&rdquo;). By creating an account or using
        the social features you agree to these terms.
      </p>

      <h2>1. Who can use it</h2>
      <p>
        You must be <b>{MIN_AGE} years old or older</b>. By creating an account you confirm that you are. We cannot
        check your age, so we rely on your confirmation. If we find an account belongs to someone under {MIN_AGE} we
        will delete it. Reading the public programme does not need an account.
      </p>

      <h2>2. Your account</h2>
      <p>
        Give accurate details and keep your password private. You are responsible for what happens under your account.
        You can delete it at any time in <a href="/settings">Settings</a>. Deletion is immediate and permanent.
      </p>

      <h2>3. What you post</h2>
      <p>
        If you turn on social features you may post quiz questions, questions and answers, votes and claims. You keep
        ownership of what you write, and you give us permission to store and display it to other opted-in users while
        your account and the feature are on. When you opt out or delete your account, we delete it. Do not post
        anything unlawful, abusive, misleading or that is another person&rsquo;s personal data, and do not try to
        manipulate votes or rankings (for example with multiple accounts). We may remove content or accounts that
        break these rules.
      </p>

      <h2>4. AI judging, and how to challenge it</h2>
      <p>
        Quizzes are written by AI and answers are judged by AI. This is automated and can be wrong. The outcome only
        affects the social features: whether a node counts as held or thin for you, ranking, and expert standing. It
        has no legal effect and does not affect your account or your access to the programme. Quizzes and AI-written
        content are labelled as AI-generated. If you think a quiz or a judgement is wrong, use the review button next
        to it: explain what is wrong and the AI will re-assess it. Results of your own answers are not changed
        retroactively unless the re-assessment finds the original was wrong.
      </p>

      <h2>5. Learning content</h2>
      <p>
        The programme links to third-party resources that we do not control. Content is for general learning, not
        professional, legal or financial advice. Expert standing on a topic reflects activity on this site only and is
        not a qualification.
      </p>

      <h2>6. Availability and liability</h2>
      <p>
        We provide the service as it is, free of charge, and may change or stop it. To the extent the law allows, we
        are not liable for indirect losses. Nothing here limits liability that cannot be limited by law, including
        for death or personal injury, or for fraud, and nothing limits your rights as a consumer.
      </p>

      <h2>7. Privacy</h2>
      <p>
        See the <a href="/privacy">Privacy Policy</a> and <a href="/cookies">Cookies</a>. Contact:{" "}
        <a href={`mailto:${CONTROLLER.email}`}>{CONTROLLER.email}</a>.
      </p>

      <h2>8. Law</h2>
      <p>
        These terms are governed by Italian law. If you are a consumer, you keep any mandatory protections of the
        country where you live, and you may bring a claim in the courts of your place of residence.
      </p>
    </LegalShell>
  );
}
