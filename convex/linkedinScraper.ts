import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import Exa from "exa-js";

// Initialize Exa client
const exa = new Exa(process.env.EXASEARCH_API_KEY);

// Helper function to extract LinkedIn URLs from markdown text
function extractLinkedInUrls(text: string): {
  companyUrls: string[];
  schoolUrls: string[];
} {
  const companyUrls: string[] = [];
  const schoolUrls: string[] = [];

  // Regex to find LinkedIn company and school URLs
  const urlRegex = /\[([^\]]+)\]\((https:\/\/(?:www\.)?linkedin\.com\/(?:company|school)\/[^\)]+)\)/g;

  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[2];
    if (url.includes('/company/')) {
      companyUrls.push(url);
    } else if (url.includes('/school/')) {
      schoolUrls.push(url);
    }
  }

  return {
    companyUrls: [...new Set(companyUrls)], // Remove duplicates
    schoolUrls: [...new Set(schoolUrls)],
  };
}

// Helper function to parse work experience from markdown
function parseWorkExperience(text: string): Array<{
  title: string;
  company: string;
  companyUrl?: string;
  companyLogo?: string;
  location?: string;
  startDate: string;
  endDate?: string;
  duration?: string;
  description?: string;
  employmentType?: string;
}> {
  const experiences: Array<any> = [];

  // Look for work experience section
  const workSectionMatch = text.match(/## Work Experience\n([\s\S]*?)(?=\n## |$)/);
  if (!workSectionMatch) return experiences;

  const workSection = workSectionMatch[1];

  // Split by experience entries (starting with - ###)
  const entries = workSection.split(/- ### /).filter(e => e.trim());

  for (const entry of entries) {
    // Extract title and company
    const titleMatch = entry.match(/^(.+?) at \[([^\]]+)\]\(([^\)]+)\)/);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    const company = titleMatch[2].trim();
    const companyUrl = titleMatch[3].trim();

    // Extract description (first line after title)
    const lines = entry.split('\n').filter(l => l.trim());
    const description = lines[1]?.trim() || undefined;

    // Extract duration and location
    const durationMatch = entry.match(/\n([A-Z][a-z]{2} \d{4}.*?)(?:\n|$)/);
    const duration = durationMatch?.[1]?.trim();

    const locationMatch = entry.match(/\n([A-Z][a-z]+(?:, [A-Z][a-z]+)?)\s*$/m);
    const location = locationMatch?.[1]?.trim();

    experiences.push({
      title,
      company,
      companyUrl,
      duration,
      location,
      description,
      companyLogo: undefined, // Will be filled later
      startDate: duration?.split(' - ')[0] || '',
      endDate: duration?.includes('Present') ? undefined : duration?.split(' - ')[1],
      employmentType: undefined,
    });
  }

  return experiences;
}

// Helper function to parse education from markdown
function parseEducation(text: string): Array<{
  school: string;
  schoolUrl?: string;
  schoolLogo?: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  grade?: string;
  activities?: string;
  description?: string;
}> {
  const education: Array<any> = [];

  // Look for education section
  const eduSectionMatch = text.match(/## Education\n([\s\S]*?)(?=\n## |$)/);
  if (!eduSectionMatch) return education;

  const eduSection = eduSectionMatch[1];

  // Split by education entries (starting with - ###)
  const entries = eduSection.split(/- ### /).filter(e => e.trim());

  for (const entry of entries) {
    // Extract degree and school
    const degreeMatch = entry.match(/^(.+?) at \[([^\]]+)\]\(([^\)]+)\)/);
    if (!degreeMatch) continue;

    const degreeInfo = degreeMatch[1].trim();
    const school = degreeMatch[2].trim();
    const schoolUrl = degreeMatch[3].trim();

    // Try to split degree into degree type and field of study
    const degreeParts = degreeInfo.split(' || ');
    const degree = degreeParts[0]?.trim();
    const fieldOfStudy = degreeParts[1]?.trim();

    education.push({
      school,
      schoolUrl,
      degree,
      fieldOfStudy,
      schoolLogo: undefined, // Will be filled later
      startDate: undefined,
      endDate: undefined,
      grade: undefined,
      activities: undefined,
      description: undefined,
    });
  }

  return education;
}

// Action to fetch company/school logo
export const fetchLogoUrl = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    try {
      // Only fetch metadata (image), not text content
      const result = await exa.getContents([args.url]);

      if (result.results && result.results.length > 0) {
        return result.results[0].image || null;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching logo for ${args.url}:`, error);
      return null;
    }
  },
});

// Main action to scrape LinkedIn profile and enrich user data
export const scrapeLinkedInProfile = action({
  args: {
    clerkId: v.string(),
    linkedinUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Fetch the LinkedIn profile
      const result = await exa.getContents([args.linkedinUrl], { text: true });

      if (!result.results || result.results.length === 0) {
        throw new Error("No results from Exa");
      }

      const profileData = result.results[0];
      const text = profileData.text || "";
      const profileImage = profileData.image || undefined;
      const name = profileData.author || undefined;

      // 2. Extract bio/about
      const aboutMatch = text.match(/## About me\n([\s\S]*?)(?=\n## |$)/);
      const about = aboutMatch?.[1]?.trim() || undefined;

      // Extract title/bio (usually the line after the name)
      const lines = text.split('\n');
      const nameIndex = lines.findIndex(l => l.includes('# '));
      const bio = nameIndex >= 0 ? lines[nameIndex + 1]?.trim() : undefined;

      // 3. Parse work experience
      const experiences = parseWorkExperience(text);

      // 4. Parse education
      const education = parseEducation(text);

      // 5. Extract LinkedIn URLs for companies and schools
      const { companyUrls, schoolUrls } = extractLinkedInUrls(text);

      // 6. Fetch logos for companies
      const companyLogos = new Map<string, string>();
      for (const url of companyUrls) {
        const logo = await ctx.runAction(api.linkedinScraper.fetchLogoUrl, { url });
        if (logo) {
          companyLogos.set(url, logo);
        }
      }

      // 7. Fetch logos for schools
      const schoolLogos = new Map<string, string>();
      for (const url of schoolUrls) {
        const logo = await ctx.runAction(api.linkedinScraper.fetchLogoUrl, { url });
        if (logo) {
          schoolLogos.set(url, logo);
        }
      }

      // 8. Add logos to experiences
      const enrichedExperiences = experiences.map(exp => ({
        ...exp,
        companyLogo: exp.companyUrl ? companyLogos.get(exp.companyUrl) : undefined,
      }));

      // 9. Add logos to education
      const enrichedEducation = education.map(edu => ({
        ...edu,
        schoolLogo: edu.schoolUrl ? schoolLogos.get(edu.schoolUrl) : undefined,
      }));

      // 10. Update user in database
      await ctx.runMutation(api.users.updateUserProfile, {
        clerkId: args.clerkId,
        name,
        image: profileImage,
        bio,
        about,
        experience: enrichedExperiences,
        education: enrichedEducation,
      });

      // 11. Generate profile vector for recommendation system
      await ctx.runMutation(api.recommendations.updateProfileVector, {
        clerkId: args.clerkId,
      });

      // 12. Mark onboarding as complete
      await ctx.runMutation(api.users.markOnboardingComplete, {
        clerkId: args.clerkId,
      });

      return {
        success: true,
        data: {
          name,
          image: profileImage,
          bio,
          about,
          experienceCount: enrichedExperiences.length,
          educationCount: enrichedEducation.length,
        },
      };
    } catch (error) {
      console.error("Error scraping LinkedIn profile:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
