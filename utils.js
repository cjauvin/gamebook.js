// http://ejohn.org/blog/fast-javascript-maxmin/
Array.max = function(arr) {
    return Math.max.apply(Math, arr);
};

// http://stackoverflow.com/a/2648463/787842
String.prototype.format = String.prototype.f = function() {
    var s = this,
    i = arguments.length;
    while (i--) { s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]); }
    return s;
};

// http://stackoverflow.com/a/4825873/787842
Array.prototype.remove = function(elem) {
    var match = -1;
    while( (match = this.indexOf(elem)) > -1 ) {
        this.splice(match, 1);
    }
};

function isInArray(elem, arr) {
    return $.inArray(elem, arr) > -1;
};

function matchInArray(pattern, arr) {
    var found = false;
    $.each(arr, function(i, s) {
        if (typeof s === 'string' && s.match(pattern)) {
            found = true;
            return false;
        }
    });
    return found;
};

// only first matching item
function removeByName(name, arr) {
    $.each(arr, function(i, item) {
        if (item.name === name) {
            arr.remove(item);
            return false;
        }
    });
};

function getNames(items) {
    return $.map(items, function (i) { return i.name; });
};

function each(that, iter, f) {
    return $.each(iter, $.proxy(f, that));
}

// taken from: http://rosettacode.org/wiki/Levenshtein_distance#JavaScript
function levenshteinDist(str1, str2) {
    var m = str1.length,
    n = str2.length,
    d = [],
    i, j;
    if (!m) { return n; }
    if (!n) { return m; }
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (j = 1; j <= n; j++) {
        for (i = 1; i <= m; i++) {
            if (str1[i-1] === str2[j-1]) { d[i][j] = d[i - 1][j - 1]; }
            else { d[i][j] = Math.min(d[i-1][j], d[i][j-1], d[i-1][j-1]) + 1; }
        }
    }
    return d[m][n];
};

// http://gotochriswest.com/blog/2011/05/02/cartesian-product-of-multiple-arrays/
function cartesianProduct(arr) {
    return Array.prototype.reduce.call(arr, function(a, b) {
        var ret = [];
        a.forEach(function(a) {
            b.forEach(function(b) {
                ret.push(a.concat([b]));
            });
        });
        return ret;
    }, [[]]);
};

function zeros(n) {
    var a = [];
    while (--n >= 0) {
        a[n] = 0;
    }
    return a;
};
