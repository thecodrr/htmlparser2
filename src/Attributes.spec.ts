import Attributes from "./Attributes";

test("get attribute", () => {
    expect(Attributes.get("hello=world", "hello")).toBe("world");
    expect(Attributes.get('hello="world"', "hello")).toBe("world");
    expect(Attributes.get("hello='world'", "hello")).toBe("world");
    expect(Attributes.get("hello", "hello")).toBe("");
    expect(Attributes.get("hello=", "hello")).toBe("");
});

test("get 1 attribute from multiple attributes", () => {
    expect(
        Attributes.get("hello=world attr2=value2 attr3='value3'", "attr3")
    ).toBe("value3");
    expect(
        Attributes.get('hello=world attr2=value2 attr3="value3"', "attr3")
    ).toBe("value3");
    expect(
        Attributes.get("hello=world attr2=value2 attr3='value3'", "attr2")
    ).toBe("value2");
    expect(
        Attributes.get("hello=world\nattr2=value2\nattr3='value3'", "attr2")
    ).toBe("value2");
    expect(
        Attributes.get(
            "hello=world\n\n\n\nattr2=value2\n\n\n\nattr3='value3'",
            "attr2"
        )
    ).toBe("value2");

    expect(
        Attributes.get(
            "hello=world\n\n\n\nattr2=value2\n\n\n\nattr3='this is a long long value' space=no",
            "attr3"
        )
    ).toBe("this is a long long value");
});

test("set attribute", () => {
    expect(
        Attributes.set(
            "hello=world\n\n\n\nattr2=value2\n\n\n\nattr3='this is a long long value' space=no",
            "attr3",
            "Changed!"
        )
    ).toBe(`hello=world\n\n\n\nattr2=value2\n\n\n\nattr3="Changed!" space=no`);

    expect(
        Attributes.set(
            `hello=world\n\n\n\nattr2=value2\n\n\n\nattr3="Changed!" space=no`,
            "attr2",
            "Changed!"
        )
    ).toBe(`hello=world    attr2="Changed!"   attr3="Changed!" space=no`);

    expect(
        Attributes.set(
            `hello attr2=value2 attr3="Changed!" space=no`,
            "hello",
            "Changed!"
        )
    ).toBe(`hello="Changed!" attr2=value2 attr3="Changed!" space=no`);

    expect(Attributes.set(`hello`, "new", "value")).toBe(`hello new="value"`);
});

test("parse attributes to JSON", () => {
    expect(
        Attributes.toJSON(
            "hello=world\n\n\n\nattr2=value2\n\n\n\nattr3='this is a long long value' space=no"
        )
    ).toMatchObject({
        hello: "world",
        attr2: "value2",
        attr3: "this is a long long value",
        space: "no",
    });

    expect(
        Attributes.toJSON(
            "hello=world\n\n\n\nattr2=value2\n\n\n\nattr3='this \\'world\\' is a long long value' space=no"
        )
    ).toMatchObject({
        hello: "world",
        attr2: "value2",
        attr3: "this \\'world\\' is a long long value",
        space: "no",
    });

    expect(Attributes.toJSON("hello world space work")).toMatchObject({
        hello: "",
        world: "",
        space: "",
        work: "",
    });

    expect(
        Attributes.toJSON(
            "href='http://example.com/p&#x61;#x61ge?param=value&param2&param3=&lt;val&; & &'"
        )
    ).toMatchObject({
        href: "http://example.com/pa#x61ge?param=value¶m2¶m3=<val&; & &",
    });

    expect(
        Attributes.toJSON("bar=&amp; baz=\"&amp;\" boo='&amp;' noo=")
    ).toMatchObject({
        bar: "&",
        baz: "&",
        boo: "&",
        noo: "",
    });

    expect(Attributes.toJSON("/bar")).toMatchObject({
        "/bar": "",
    });
});

test("stringify attributes from JSON", () => {
    expect(
        Attributes.toString(
            Attributes.toJSON(
                "hello=world\n\n\n\nattr2=value2\n\n\n\nattr3='this is a long long value' space=no"
            )
        )
    ).toBe(
        `hello="world" attr2="value2" attr3="this is a long long value" space="no"`
    );
});
