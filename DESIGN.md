# KIMMYNAILS Design System

## Intent

Faithful recreation of the current kimmynail.de brand site. Preserve the calm luxury salon atmosphere, German copy, image-led composition and conversion paths.

## Theme

Light-only brand presentation, matching the source website. White is the main canvas with very pale pink section surfaces and champagne-gold accents.

## Color

- Canvas: `#FFFFFF`
- Soft surface: `#FDF9F5`
- Hairline: `#E8E0D8`
- Primary gold: `#C9A978`
- Dark gold: `#A8894D`
- Ink: `#1A1A1A`
- Body: `#666666`
- Blush glow: `rgba(255, 182, 193, 0.72)`
- Gold glow: `rgba(212, 175, 55, 0.52)`

## Typography

- Brand and interface: Urbanist, variable, locally hosted.
- Editorial hero: Playfair Display, variable, locally hosted.
- Body and form controls: Inter, variable, locally hosted.
- Hero headlines are spacious, medium weight and gold with subtle shadow.
- Section headings use Urbanist at light weights.
- Labels use small uppercase Urbanist with deliberate tracking.

## Shape

- Images use organic clipped silhouettes with pink and gold ambient halos.
- Cards and fields use 4-8px radii.
- Primary actions are pill-shaped at 30-40px radius.
- FAQ controls use circular 30-36px toggles.

## Layout

- Fixed 80px desktop navigation, 64px mobile navigation.
- Desktop hero is a three-column composition: editorial text, centered hand image, editorial text.
- Content max widths range from 800px for text to 1400px for navigation and hero.
- Major sections use 80-160px vertical spacing on desktop and 72-100px on mobile.
- Desktop booking and contact sections are split 50/50.
- Mobile collapses to one column and uses horizontal carousels for studio/services.

## Motion

- Soft load-in choreography for hero, navigation and image.
- IntersectionObserver reveals for major blocks.
- Carousel autoplay pauses on user interaction.
- Organic image halos drift slowly.
- All automatic motion is disabled under `prefers-reduced-motion: reduce`.

## Components

- Fixed Header with desktop links and full-screen mobile menu.
- OrganicImage with layered pink/gold halos.
- StudioCarousel.
- Services showcase and complete price modal.
- Gallery masonry, show-more control and accessible lightbox.
- Testimonial carousel.
- Two-step booking selector with embedded Google Appointment Schedule.
- FAQ accordion.
- Contact form, business details and map.
- Responsive footer and legal content pages.

## Accessibility

- Visible keyboard focus using the dark gold token.
- Semantic landmarks and button elements.
- Modal focus entry, Escape close and scroll locking.
- Descriptive image alt text.
- Touch targets at least 44px.
- Reduced-motion support.
