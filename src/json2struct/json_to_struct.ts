export class Json2Struct {
    flatten: boolean;
    innerTabs = 0;
    stack = [];
    parent = "";
    seen = {};
    tabs = 0;
    example: boolean;
    accumulator = "";
    go = "";
    data: any;

    jsonToStruct(json, typename = null, flatten = true, example = false): any {
        this.flatten = flatten;
        this.example = example;
		let scope: any

        try
        {
            this.data = JSON.parse(json.replace(/:(\s*\d*)\.0/g, ":$1.1")); // hack that forces floats to stay as floats
            scope = this.data;
        }
        catch (e)
        {
            return {
                go: "",
                error: e.message
            };
        }

        typename = this.format(typename || "AutoGenerated");
        this.append(`type ${typename} `);

        this.parseScope(scope);

        return {
            go: flatten
                ? this.go += this.accumulator
                : this.go
        };
    }

    parseScope(scope: any, depth = 0) {
        if (typeof scope === "object" && scope !== null)
		{
			if (Array.isArray(scope))
			{	
				let sliceType;
				const scopeLength = scope.length;

				for (let i = 0; i < scopeLength; i++)
				{
					const thisType = this.goType(scope[i]);
					if (!sliceType)
						sliceType = thisType;
					else if (sliceType != thisType)
					{
						sliceType = this.mostSpecificPossibleGoType(thisType, sliceType);
						if (sliceType == "interface{}")
							break;
					}
				}

				const slice = this.flatten && ["struct", "slice"].includes(sliceType)
					? `*[]${this.parent}`
					: `*[]`;

				if (this.flatten && depth >= 2)
					this.appender(slice);
				else
					this.append(slice)
				if (sliceType == "struct") {
					const allFields = {};

					// for each field counts how many times appears
					for (let i = 0; i < scopeLength; i++)
					{
						const keys = Object.keys(scope[i])
                        for (let k in keys)
						{
							let keyname = keys[k];
							if (!(keyname in allFields)) {
								allFields[keyname] = {
									value: scope[i][keyname],
									count: 0
								}
							}
							else {
								const existingValue = allFields[keyname].value;
								const currentValue = scope[i][keyname];

								if (this.compareObjects(existingValue, currentValue)) {
									const comparisonResult = this.compareObjectKeys(
										Object.keys(currentValue),
										Object.keys(existingValue)
									)
									if (!comparisonResult) {
										keyname = `${keyname}_${this.uuidv4()}`;
										allFields[keyname] = {
											value: currentValue,
											count: 0
										};
									}
								}
							}
							allFields[keyname].count++;
						}
					}

					// create a common struct with all fields found in the current array
					// omitempty dict indicates if a field is optional
					const keys = Object.keys(allFields), struct = {}, omitempty = {};
					for (let k in keys)
					{
						const keyname = keys[k], elem = allFields[keyname];
						struct[keyname] = elem.value;
						omitempty[keyname] = elem.count != scopeLength;
					}

					this.parseStruct(depth + 1, this.innerTabs, struct, omitempty); // finally parse the struct !!
				}
				else if (sliceType == "slice") {
					this.parseScope(scope[0], depth)
				}
				else {
					if (this.flatten && depth >= 2) {
						this.appender(sliceType || "interface{}");
					} else {
						this.append(sliceType || "interface{}");
					}
				}
			}
			else
			{
				if (this.flatten) {
					if (depth >= 2){
						this.appender("*" + this.parent)
					}
					else {
						this.append("*" + this.parent)
					}
				}
				this.parseStruct(depth + 1, this.innerTabs, scope);
			}
		}
		else {
			if (this.flatten && depth >= 2){
				this.appender("*" + this.goType(scope));
			}
			else {
				this.append("*" + this.goType(scope));
			}
		}
    }

    parseStruct(depth, innerTabs, scope, omitempty = null) : void
	{
		if (this.flatten) {
			this.stack.push(
				depth >= 2
				? "\n"
				: ""
			)
		}

		const seenTypeNames = [];

		if (this.flatten && depth >= 2)
		{
			const parentType = `type ${this.parent}`;
			const scopeKeys = this.formatScopeKeys(Object.keys(scope));

			// this can only handle two duplicate items
			// future improvement will handle the case where there could
			// three or more duplicate keys with different values
			if (this.parent in this.seen && this.compareObjectKeys(scopeKeys, this.seen[this.parent])) {
				this.stack.pop();
				return
			}
			this.seen[this.parent] = scopeKeys;

			this.appender(`${parentType} struct {\n`);
			++innerTabs;
			const keys = Object.keys(scope);
            
			for (let i = 0; i<keys.length; i++)
			{
				const keyname = this.getOriginalName(keys[i]);
				this.indenter(innerTabs)
                
				const typename = this.uniqueTypeName(this.format(keyname), seenTypeNames)
				seenTypeNames.push(typename);

				this.appender(typename+" ");
				this.parent = typename;

				this.parseScope(scope[keys[i]], depth);

				this.appender(' `json:"'+keyname);
				if (omitempty && omitempty[keys[i]] === true)
				{
					this.appender(',omitempty');
				}
				this.appender('"`\n');
			}
			this.indenter(--innerTabs);
			this.appender("}");
		}
		else
		{
			this.append("struct {\n");

			++this.tabs;
			const keys = Object.keys(scope);
			for (let i in keys)
			{
				const keyname = this.getOriginalName(keys[i]);
				this.indent(this.tabs);
				const typename = this.uniqueTypeName(this.format(keyname), seenTypeNames)
				seenTypeNames.push(typename)
				this.append(typename+" ");
				this.parent = typename
				this.parseScope(scope[keys[i]], depth);
				this.append(' `json:"'+keyname);
				if (omitempty && omitempty[keys[i]] === true)
				{
					this.append(',omitempty');
				}
				if (this.example && scope[keys[i]] !== "" && typeof scope[keys[i]] !== "object")
				{
					this.append('" example:"'+scope[keys[i]])
				}
				this.append('"`\n');
			}
			this.indent(--this.tabs);
			this.append("}");
		}

		if (this.flatten)
			this.accumulator += this.stack.pop();
	}

    indent(tabs)
	{
		for (let i = 0; i < tabs; i++)
			this.go += '\t';
	}

	append(str)
	{
		this.go += str;
	}

	indenter(tabs)
	{
		for (let i = 0; i < tabs; i++)
			this.stack[this.stack.length - 1] += '\t';
	}

	appender(str)
	{
		this.stack[this.stack.length - 1] += str;
	}

	// Generate a unique name to avoid duplicate struct field names.
	// This function appends a number at the end of the field name.
	uniqueTypeName(name, seen) {
		if (seen.indexOf(name) === -1) {
			return name;
		}

		let i = 0;
		while (true) {
			let newName = name + i.toString();
			if (seen.indexOf(newName) === -1) {
				return newName;
			}

			i++;
		}
	}

	// Sanitizes and formats a string to make an appropriate identifier in Go
	format(str)
	{
		str = this.formatNumber(str);

		let sanitized = this.toProperCase(str).replace(/[^a-z0-9]/ig, "")
		if (!sanitized) {
			return "NAMING_FAILED";
		}

		// After sanitizing the remaining characters can start with a number.
		// Run the sanitized string again trough formatNumber to make sure the identifier is Num[0-9] or Zero_... instead of 1.
		return this.formatNumber(sanitized)
	}

	// Adds a prefix to a number to make an appropriate identifier in Go
	formatNumber(str) {
		if (!str)
			return "";
		else if (str.match(/^\d+$/))
			str = "Num" + str;
		else if (str.charAt(0).match(/\d/))
		{
			const numbers = {'0': "Zero_", '1': "One_", '2': "Two_", '3': "Three_",
				'4': "Four_", '5': "Five_", '6': "Six_", '7': "Seven_",
				'8': "Eight_", '9': "Nine_"};
			str = numbers[str.charAt(0)] + str.substr(1);
		}

		return str;
	}

	// Determines the most appropriate Go type
	goType(val)
	{
		if (val === null)
			return "interface{}";

		switch (typeof val)
		{
			case "string":
				if (/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(\+\d\d:\d\d|Z)/.test(val))
					return "time.Time";
				else
					return "string";
			case "number":
				if (val % 1 === 0)
				{
					if (val > -2147483648 && val < 2147483647)
						return "int";
					else
						return "int64";
				}
				else
					return "float64";
			case "boolean":
				return "bool";
			case "object":
				if (Array.isArray(val))
					return "slice";
				return "struct";
			default:
				return "interface{}";
		}
	}

	// Given two types, returns the more specific of the two
	mostSpecificPossibleGoType(typ1, typ2)
	{
		if (typ1.substr(0, 5) == "float"
				&& typ2.substr(0, 3) == "int")
			return typ1;
		else if (typ1.substr(0, 3) == "int"
				&& typ2.substr(0, 5) == "float")
			return typ2;
		else
			return "interface{}";
	}

	// Proper cases a string according to Go conventions
	toProperCase(str)
	{
		// ensure that the SCREAMING_SNAKE_CASE is converted to snake_case
		if (str.match(/^[_A-Z0-9]+$/)) {
			str = str.toLowerCase();
		}

		// https://github.com/golang/lint/blob/5614ed5bae6fb75893070bdc0996a68765fdd275/lint.go#L771-L810
		const commonInitialisms = [
			"ACL", "API", "ASCII", "CPU", "CSS", "DNS", "EOF", "GUID", "HTML", "HTTP",
			"HTTPS", "ID", "IP", "JSON", "LHS", "QPS", "RAM", "RHS", "RPC", "SLA",
			"SMTP", "SQL", "SSH", "TCP", "TLS", "TTL", "UDP", "UI", "UID", "UUID",
			"URI", "URL", "UTF8", "VM", "XML", "XMPP", "XSRF", "XSS"
		];

		return str.replace(/(^|[^a-zA-Z])([a-z]+)/g, function(unused, sep, frag)
		{
			if (commonInitialisms.indexOf(frag.toUpperCase()) >= 0)
				return sep + frag.toUpperCase();
			else
				return sep + frag[0].toUpperCase() + frag.substr(1).toLowerCase();
		}).replace(/([A-Z])([a-z]+)/g, function(unused, sep, frag)
		{
			if (commonInitialisms.indexOf(sep + frag.toUpperCase()) >= 0)
				return (sep + frag).toUpperCase();
			else
				return sep + frag;
		});
	}

	uuidv4() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		  return v.toString(16);
		});
	}

	getOriginalName(unique) {
		const reLiteralUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		const uuidLength = 36;

		if (unique.length >= uuidLength) {
			const tail = unique.substr(-uuidLength);
			if (reLiteralUUID.test(tail)) {
				return unique.slice(0, -1 * (uuidLength + 1))
			}
		}
		return unique
	}

	compareObjects(objectA, objectB) {
		const object = "[object Object]";
		return Object.prototype.toString.call(objectA) === object
			&& Object.prototype.toString.call(objectB) === object;
	}

	compareObjectKeys(itemAKeys, itemBKeys) {
		const lengthA = itemAKeys.length;
		const lengthB = itemBKeys.length;

		// nothing to compare, probably identical
		if (lengthA == 0 && lengthB == 0)
			return true;

		// duh
		if (lengthA != lengthB)
			return false;

		for (let item of itemAKeys) {
			if (!itemBKeys.includes(item))
				return false;
		}
		return true;
	}

	formatScopeKeys(keys) {
		for (let i in keys) {
			keys[i] = this.format(keys[i]);
		}
		return keys
	}
}