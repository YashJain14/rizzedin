# Bulk User Import

This admin tool allows you to populate the database with multiple users at once by providing LinkedIn profile URLs.

## How to Use

1. Navigate to `/admin/bulk-import` in your browser
2. Paste LinkedIn profile URLs in the textarea, one URL per line
3. Click "Import Users"
4. The system will:
   - Create a unique user account for each LinkedIn profile
   - Assign random (but realistic) demographic data (age, gender, dating preference)
   - Scrape their LinkedIn profile for work experience and education
   - Generate profile embeddings for matching
   - Display success/failure results for each URL

## Features

- **Duplicate Detection**: Prevents importing the same LinkedIn URL twice
- **Real-time Progress**: Shows current progress as users are imported
- **Error Handling**: Displays specific error messages for failed imports
- **Detailed Results**: Shows success/failure status for each URL

## Notes

- Each imported user gets a unique clerk ID in the format `bulk_<username>_<timestamp>`
- Users are assigned random demographics to simulate real user diversity
- The LinkedIn scraping happens automatically during import
- Profile vectors are generated for the recommendation system
- All users are marked as having completed onboarding

## Example Usage

```
https://linkedin.com/in/user1
https://linkedin.com/in/user2
https://linkedin.com/in/user3
```
