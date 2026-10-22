import type { Profile } from "@prisma/client";

/** Semantic form fields Sento knows how to fill from a profile. */
export type FieldKey =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "location"
  | "linkedin"
  | "github"
  | "website"
  | "workAuthorization"
  | "sponsorship"
  | "coverLetter";

/** Map a profile into the concrete string values used to fill a form. */
export function profileValues(
  profile: Profile,
  coverLetterText: string | null,
): Partial<Record<FieldKey, string>> {
  const [firstName, ...rest] = profile.fullName.trim().split(/\s+/);
  const lastName = rest.join(" ");
  return {
    firstName: firstName ?? "",
    lastName,
    fullName: profile.fullName,
    email: profile.email,
    ...(profile.phone ? { phone: profile.phone } : {}),
    ...(profile.location ? { location: profile.location } : {}),
    ...(profile.linkedinUrl ? { linkedin: profile.linkedinUrl } : {}),
    ...(profile.githubUrl ? { github: profile.githubUrl } : {}),
    ...(profile.websiteUrl ? { website: profile.websiteUrl } : {}),
    ...(profile.workAuthorization ? { workAuthorization: profile.workAuthorization } : {}),
    sponsorship: profile.requiresSponsorship ? "Yes" : "No",
    ...(coverLetterText ? { coverLetter: coverLetterText } : {}),
  };
}

const PATTERNS: { key: FieldKey; re: RegExp }[] = [
  { key: "firstName", re: /first[\s_-]?name|given[\s_-]?name|forename/i },
  { key: "lastName", re: /last[\s_-]?name|surname|family[\s_-]?name/i },
  { key: "email", re: /e-?mail/i },
  { key: "phone", re: /phone|mobile|tel\b/i },
  { key: "linkedin", re: /linked[\s_-]?in/i },
  { key: "github", re: /git[\s_-]?hub/i },
  { key: "website", re: /website|portfolio|personal[\s_-]?site|url\b/i },
  { key: "location", re: /location|city|address|where.*based/i },
  { key: "sponsorship", re: /sponsor|visa|work[\s_-]?authoriz/i },
  { key: "coverLetter", re: /cover[\s_-]?letter|why.*(apply|interest)|message to/i },
  // fullName last so first/last win when both exist.
  { key: "fullName", re: /full[\s_-]?name|^name$|your name|legal name/i },
];

/**
 * Classify a form field from its descriptor text (name/id/label/placeholder).
 * Returns null when nothing is confidently recognized — the caller then treats
 * it as an unknown required question and hands off to a human.
 */
export function classifyField(descriptor: string): FieldKey | null {
  const d = descriptor.trim();
  if (!d) return null;
  for (const { key, re } of PATTERNS) {
    if (re.test(d)) return key;
  }
  return null;
}
