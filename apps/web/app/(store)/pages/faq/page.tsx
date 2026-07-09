import React from "react";
import {faqContent} from "@/app/(store)/pages/faq/_content";
import {slugify} from "@/lib/utils";
import {Page, PageContent, PageHeader} from "@/components/Page";

type Faq = [string, React.ReactNode];
type FaqListProps = {
  title: string;
  items: Faq[]
};

type FaqListComponentProps = {
  faqs: FaqListProps[];
};

function FaqItem(
  {
    faq,
    sectionId,
    itemIndex,
  }: {
    faq: Faq;
    sectionId: string;
    itemIndex: number;
  }) {
  const [q, children] = faq;

  return (
    <section className="collapse collapse-arrow border border-base-300">
      <input
        type="radio"
        name={`faq-${sectionId}`}
        defaultChecked={itemIndex === -1}
      />
      <h2 className="collapse-title font-semibold">{q}</h2>
      <div className="collapse-content text-sm space-y-4">
        {children}
      </div>
    </section>
  );
}

function FaqList({faqs}: FaqListComponentProps) {
  return (
    <div className="space-y-10">
      <nav aria-label="Table of contents" className="space-y-3">
        <h2 className="text-lg font-semibold">Contents</h2>
        <ul className="list-disc pl-5 space-y-2">
          {faqs.map(({title}) => {
            const sectionId = slugify(title);

            return (
              <li key={sectionId}>
                <a href={`#${sectionId}`} className="link link-hover">
                  {title}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-8">
        {faqs.map(({title, items}) => {
          const sectionId = slugify(title);

          return (
            <section key={sectionId} id={sectionId} className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-semibold">{title}</h2>
              <div className="space-y-3">
                {items.map((faq, itemIndex) => (
                  <FaqItem
                    key={`${sectionId}-${itemIndex}`}
                    faq={faq}
                    sectionId={sectionId}
                    itemIndex={itemIndex}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FaqPage() {
  return (
    <Page>
      <PageHeader>
        Frequently Asked Questions
      </PageHeader>
      <PageContent>
        <FaqList faqs={faqContent as FaqListProps[]}/>
      </PageContent>
    </Page>
  );
}

export default FaqPage;