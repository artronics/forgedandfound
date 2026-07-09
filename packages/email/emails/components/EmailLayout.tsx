import React from "react";
import {Body, Container, Head, Html, Preview} from "react-email";
import {pixelBasedPreset, Tailwind} from "react-email";

interface Props {
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout(
  {
    preview,
    children,
  }: Props) {
  return (
    <Html>
      <Head/>

      <Preview>{preview}</Preview>

      <Body>
        <Container>
          <Tailwind config={{
            presets: [pixelBasedPreset],
            theme: {
              extend: {
                colors: {
                  brand: "#007291",
                  primary: "#007291",
                },
              },
            },
          }}
          >
            {children}
          </Tailwind>
        </Container>
      </Body>
    </Html>
  );
}