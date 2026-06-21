export const generationResponseSchema = {
  type: "object",
  properties: {
    briefSummary: { type: "string" },
    strategy: {
      type: "object",
      properties: {
        primaryDirection: { type: "string" },
        languageGuidance: { type: "string" },
        creativityInterpretation: { type: "string" }
      },
      required: ["primaryDirection", "languageGuidance", "creativityInterpretation"]
    },
    candidates: {
      type: "array",
      minItems: 12,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          idHint: { type: "string" },
          name: { type: "string" },
          displayName: { type: "string" },
          pronunciation: { type: "string" },
          language: {
            type: "string",
            enum: ["english", "english_korean", "korean", "open_mix"]
          },
          techniques: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "descriptive",
                "blend",
                "metaphor",
                "invented",
                "benefit_led",
                "persona_led",
                "phonetic",
                "story"
              ]
            }
          },
          globalFit: {
            type: "string",
            enum: ["strong", "good", "caution", "weak"]
          },
          positioning: { type: "string" },
          rationale: { type: "string" },
          soundProfile: {
            type: "object",
            properties: {
              syllables: { type: "integer" },
              rhythm: { type: "string" },
              mouthfeel: { type: "string" }
            },
            required: ["syllables", "rhythm", "mouthfeel"]
          },
          scores: {
            type: "object",
            properties: {
              memorability: { type: "integer" },
              pronunciation: { type: "integer" },
              distinctiveness: { type: "integer" },
              scalability: { type: "integer" },
              globalReadiness: { type: "integer" }
            },
            required: [
              "memorability",
              "pronunciation",
              "distinctiveness",
              "scalability",
              "globalReadiness"
            ]
          },
          risks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "string", enum: ["low", "medium", "high"] },
                label: { type: "string" },
                note: { type: "string" }
              },
              required: ["level", "label", "note"]
            }
          },
          bestFor: { type: "array", items: { type: "string" } },
          avoidIf: { type: "array", items: { type: "string" } },
          taglineSeeds: { type: "array", items: { type: "string" } },
          variants: { type: "array", items: { type: "string" } },
          recommendedTransformations: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "more_like_this",
                "shorter",
                "more_premium",
                "more_playful",
                "more_minimal",
                "english_only",
                "korean_friendly",
                "more_invented",
                "more_descriptive"
              ]
            }
          }
        },
        required: [
          "idHint",
          "name",
          "displayName",
          "pronunciation",
          "language",
          "techniques",
          "globalFit",
          "positioning",
          "rationale",
          "soundProfile",
          "scores",
          "risks",
          "bestFor",
          "avoidIf",
          "taglineSeeds",
          "variants",
          "recommendedTransformations"
        ]
      }
    },
    sessionInsight: { type: "string" },
    suggestedNextActions: { type: "array", items: { type: "string" } }
  },
  required: ["briefSummary", "strategy", "candidates", "sessionInsight", "suggestedNextActions"]
} as const;

export const variationResponseSchema = {
  type: "object",
  properties: {
    sourceName: { type: "string" },
    transformation: {
      type: "string",
      enum: [
        "more_like_this",
        "shorter",
        "more_premium",
        "more_playful",
        "more_minimal",
        "english_only",
        "korean_friendly",
        "more_invented",
        "more_descriptive"
      ]
    },
    candidates: {
      ...generationResponseSchema.properties.candidates,
      minItems: 6,
      maxItems: 6
    },
    variationInsight: { type: "string" }
  },
  required: ["sourceName", "transformation", "candidates", "variationInsight"]
} as const;
