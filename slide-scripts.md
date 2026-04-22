# Slide Scripts

## Sustainability

Each tracker is built to stay in service across many delivery cycles, so one device supports trip after trip instead of being replaced quickly. On the data side, it only transmits when there is something important to report, which reduces unnecessary network chatter and backend processing. That combination helps us improve sustainability in both the physical product and the digital infrastructure.

## Security

We protect the system in layers, starting at the device side where nearby communication and gateway checks help reject unknown senders before data ever reaches the internet. Once traffic moves upstream, identity and session controls make sure only approved users can access the app. Then database permissions lock actions down further so each role can only read or change exactly what it needs.

## Client Stack & Data Flow

This slide breaks the mobile app into three connected pieces: the core tech stack, the Firebase integration layer, and the client-side architecture that shapes the data. We use Expo with TypeScript on the frontend, and Firebase handles both identity and real-time event delivery. Instead of polling, the app listens continuously so incoming updates appear immediately in the interface. After data arrives, we parse and aggregate it into the models that power the dashboard, map, and digital twin screens.
