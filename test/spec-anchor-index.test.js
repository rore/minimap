import assert from "node:assert/strict";
import test from "node:test";
import { createTextAnchor, resolveTextAnchor } from "../package/minimap/src/sessions.js";

// Expected values were captured from the original resolver before indexing.
const examples = [
  { name: "offset zero", text: "alpha\nbeta", anchor: { quote: "alpha" } },
  { name: "LF trailing newline", text: "alpha\nbeta\n", anchor: { quote: "beta\n" } },
  { name: "CRLF trailing newline", text: "alpha\r\nbeta\r\n", anchor: { quote: "beta\r\n" } },
  { name: "multiline quote ending at next line", text: "start\nmiddle\nfinish", anchor: { quote: "start\nmiddle\n" } },
  { name: "newline alone", text: "a\nb\n", anchor: { quote: "\n" } },
  { name: "bare CR is not a line break", text: "a\rb", anchor: { quote: "\r" } },
  { name: "Unicode code unit offsets", text: "🌿 α\r\n# H\r\n🌿 β\r\n", anchor: { quote: "🌿 β\r\n", headingPath: ["H"] } },
  { name: "nonoverlapping repeated matches", text: "aaaa", anchor: { quote: "aa" } },
  { name: "before first heading", text: "word\n# Chapter\nword", anchor: { quote: "word", headingPath: [] } },
  { name: "nested heading", text: "# Top\nword\n## Child\nword\n", anchor: { quote: "word", headingPath: ["Top", "Child"] } },
  { name: "fenced heading ignored", text: "# Top\n```\n# Ignored\nword\n```\n## Child\nword", anchor: { quote: "word", headingPath: ["Top", "Child"] } },
  { name: "skipped heading level", text: "# Top\n### Deep\nword", anchor: { quote: "word", headingPath: ["Top", "Deep"] } },
  { name: "heading boundary includes current heading", text: "# Top\nintro\n## Child\nword", anchor: { quote: "## Child", headingPath: ["Top", "Child"] } },
  { name: "CRLF markdown fallback", text: "# H\r\nA **bold** quote.\r\n", anchor: { quote: "A bold quote.", headingPath: ["H"] } },
  { name: "line-range tier precedes heading tier", text: "# A\nword\n# B\nword", anchor: { quote: "word", lineStart: 2, lineEnd: 2, headingPath: ["B"] } },
  { name: "section cascade unchanged", text: "# Top\n## Child\nword", anchor: { scope: "section", headingPath: ["Child"] } },
];

const expected = [
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 1,
      "lineEnd": 1
    },
    "created": {
      "scope": "anchor",
      "quote": "alpha",
      "headingPath": [],
      "lineStart": 1,
      "lineEnd": 1,
      "offset": 0,
      "selectedHash": "sha256:8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8",
      "fileHash": "sha256:bbfb79e82216bd2db1ad2c507d44ddf80aeb12f64f9562056afe93aad43154d9"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 2,
      "lineEnd": 3
    },
    "created": {
      "scope": "anchor",
      "quote": "beta\n",
      "headingPath": [],
      "lineStart": 2,
      "lineEnd": 3,
      "offset": 6,
      "selectedHash": "sha256:f2c82decdd7181cf98945929a62598db7e6b477e11f6e0eb0ae97020eff151ad",
      "fileHash": "sha256:e49c81e2d2f84e259d40e2fb8192f3bcd198b355184845d76d8f58807d0d78ee"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 2,
      "lineEnd": 3
    },
    "created": {
      "scope": "anchor",
      "quote": "beta\r\n",
      "headingPath": [],
      "lineStart": 2,
      "lineEnd": 3,
      "offset": 7,
      "selectedHash": "sha256:a5406fc126c2bf45b47433c7b2676cce32321fd95d9c67a7dff067249abdb712",
      "fileHash": "sha256:98ab4d3aeab1e120560e942e2df6a0db1147bf94bafcf1590000ffb3c2b6fc80"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 1,
      "lineEnd": 3
    },
    "created": {
      "scope": "anchor",
      "quote": "start\nmiddle\n",
      "headingPath": [],
      "lineStart": 1,
      "lineEnd": 3,
      "offset": 0,
      "selectedHash": "sha256:8e0de912b0691df67029d1ba39191c86809dff25f595447f6e5cc921984f5d3b",
      "fileHash": "sha256:0efbc8391684f876e0c7a4f591b4941202377baa89f4f93fd8b31e9350c4d67c"
    }
  },
  {
    "resolved": {
      "status": "ambiguous",
      "strategy": "heading_quote"
    },
    "created": {
      "scope": "anchor",
      "quote": "\n",
      "headingPath": [],
      "lineStart": 1,
      "lineEnd": 2,
      "offset": 1,
      "selectedHash": "sha256:01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
      "fileHash": "sha256:911169ddaaf146aff539f58c26c489af3b892dff0fe283c1c264c65ae5aa59a2"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 1,
      "lineEnd": 1
    },
    "created": {
      "scope": "anchor",
      "quote": "\r",
      "headingPath": [],
      "lineStart": 1,
      "lineEnd": 1,
      "offset": 1,
      "selectedHash": "sha256:9d1e0e2d9459d06523ad13e28a4093c2316baafe7aec5b25f30eba2e113599c4",
      "fileHash": "sha256:af9081672dd5ef3247a30c2db5b0dafcc9bcf981a26aefb3c55d210d43fcc14e"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 3,
      "lineEnd": 4
    },
    "created": {
      "scope": "anchor",
      "quote": "🌿 β\r\n",
      "headingPath": [
        "H"
      ],
      "lineStart": 3,
      "lineEnd": 4,
      "offset": 11,
      "selectedHash": "sha256:b6cfb976a87b53450d95703c2e46705ab10fbc083cef9eeb972da67e66ab2104",
      "fileHash": "sha256:445425eded1f1517786d65a8aaa03f9c484d4728b8067533c86cac98300bbef5"
    }
  },
  {
    "resolved": {
      "status": "ambiguous",
      "strategy": "heading_quote"
    },
    "created": {
      "scope": "anchor",
      "quote": "aa",
      "headingPath": [],
      "lineStart": 1,
      "lineEnd": 1,
      "offset": 0,
      "selectedHash": "sha256:961b6dd3ede3cb8ecbaacbd68de040cd78eb2ed5889130cceb4c49268ea4d506",
      "fileHash": "sha256:61be55a8e2f6b4e172338bddf184d6dbee29c98853e0a0485ecee7f27b9af0b4"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 1,
      "lineEnd": 1
    },
    "created": {
      "scope": "anchor",
      "quote": "word",
      "headingPath": [],
      "lineStart": 1,
      "lineEnd": 1,
      "offset": 0,
      "selectedHash": "sha256:98c1eb4ee93476743763878fcb96a25fbc9a175074d64004779ecb5242f645e6",
      "fileHash": "sha256:2c78487134de92e282a90b6c35da4e621b5efae3f8d2a300193f324260a326d4"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 4,
      "lineEnd": 4
    },
    "created": {
      "scope": "anchor",
      "quote": "word",
      "headingPath": [
        "Top",
        "Child"
      ],
      "lineStart": 2,
      "lineEnd": 2,
      "offset": 6,
      "selectedHash": "sha256:98c1eb4ee93476743763878fcb96a25fbc9a175074d64004779ecb5242f645e6",
      "fileHash": "sha256:7a25d1711e455e0053ff508e2c1ba69525cf6be144da8636cf3155057a6883ff"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 7,
      "lineEnd": 7
    },
    "created": {
      "scope": "anchor",
      "quote": "word",
      "headingPath": [
        "Top",
        "Child"
      ],
      "lineStart": 4,
      "lineEnd": 4,
      "offset": 20,
      "selectedHash": "sha256:98c1eb4ee93476743763878fcb96a25fbc9a175074d64004779ecb5242f645e6",
      "fileHash": "sha256:39ed06a4c793954de5bdec0b7f2f2241c4982cc8242a86464e5a3e34c8f60bbb"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 3,
      "lineEnd": 3
    },
    "created": {
      "scope": "anchor",
      "quote": "word",
      "headingPath": [
        "Top",
        "Deep"
      ],
      "lineStart": 3,
      "lineEnd": 3,
      "offset": 15,
      "selectedHash": "sha256:98c1eb4ee93476743763878fcb96a25fbc9a175074d64004779ecb5242f645e6",
      "fileHash": "sha256:23106c47b4f15ec34f5137e624dc44c4ecf970a72856b70ea88c92e64f490dc5"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 3,
      "lineEnd": 3
    },
    "created": {
      "scope": "anchor",
      "quote": "## Child",
      "headingPath": [
        "Top",
        "Child"
      ],
      "lineStart": 3,
      "lineEnd": 3,
      "offset": 12,
      "selectedHash": "sha256:275ffbdaf209e983dc4a3ced190134281a8f6f49d540445e7815dbe09c2d8e62",
      "fileHash": "sha256:6dba60e7af9e13ef4739a96a578de01b67dce2a9e237b0e4af3edf387ff84dff"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_quote",
      "lineStart": 2,
      "lineEnd": 2
    },
    "created": {
      "scope": "anchor",
      "quote": "A bold quote.",
      "headingPath": [
        "H"
      ],
      "lineStart": 2,
      "lineEnd": 2,
      "offset": 4,
      "selectedHash": "sha256:b5a3f2e80d75c84fd575bb0d0c9d5fb0e7814f877c47a3eccb7ed17b21b68bd8",
      "fileHash": "sha256:2db69e82cfb8cf55a9f89eef62bfde79648a11d3cb5dc7a9da3444d87631db17"
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "line_range",
      "lineStart": 2,
      "lineEnd": 2
    }
  },
  {
    "resolved": {
      "status": "resolved",
      "strategy": "heading_path",
      "lineStart": 2,
      "lineEnd": 2,
      "headingPath": [
        "Top",
        "Child"
      ]
    }
  }
];

test("indexed quote and heading lookup matches the original resolver corpus exactly", () => {
  assert.equal(expected.length, examples.length);
  for (const [index, example] of examples.entries()) {
    assert.deepEqual(resolveTextAnchor(example.text, example.anchor), expected[index].resolved, example.name);
    if (example.anchor.scope !== "section" && !example.anchor.lineStart) {
      let actual;
      try { actual = createTextAnchor(example.text, { ...example.anchor, quoteOffset: 0 }); }
      catch (error) { actual = { error: error.code }; }
      assert.deepEqual(actual, expected[index].created, `${example.name}: creation`);
    }
  }
});

test("repeated literal quotes prepare the outline once instead of rescanning per match", () => {
  const text = Array.from({ length: 2000 }, () => "Repeated sentence in a specification.").join("\n");
  const original = String.prototype.split;
  let splits = 0;
  try {
    String.prototype.split = function (...args) { splits++; return original.apply(this, args); };
    assert.deepEqual(resolveTextAnchor(text, { quote: "Repeated sentence" }), { status: "ambiguous", strategy: "heading_quote" });
  } finally { String.prototype.split = original; }
  assert.equal(splits, 1);
});
