const fs = require('fs');
const http = require('http');
const url = require('url');
const path = require('path');

if (process.argv.length != 6) {
    console.error("Usage: " + __filename + " <bind_address> <bind_port> <bgpmon_trigger> <bgpmon_out>");
    return
}

const mon_trigger = process.argv[4];
const mon_out = process.argv[5];

const BGPMonClient = function (in_fifo, out_fifo) {
    const o_stream = fs.createReadStream(out_fifo);
    const i_stream = fs.createWriteStream(in_fifo);

    return new Promise((res, rej) => {
        if (!o_stream.readable || !i_stream.writable) {
            rej ("I/O unavailable.");
            [o_stream, i_stream].forEach(s => s.close());
        }
        else {
            try {
                i_stream.write('_');
                o_stream.on('data', (data) => {
                    res(data.toString()
                        .split('\n')
                        .filter(line => line != '')
                        .map(line => line.split('|'))
                        .map(col => {
                            try {
                                return { 
                                    as: col[0], 
                                    peers: col[1].split(';').filter(elem => elem != ''),
                                    routes: col[2].split(';').filter(elem => elem != '')
                                        .map(r => r.split(','))
                                        .map(r => { 
                                            try {
                                                return { 
                                                    prefix: r[0], 
                                                    as_path: r[1].split(' ').filter(elem => elem != ''), 
                                                    nexthop: r[2], 
                                                    local: r[3] != '0' 
                                                }; 
                                            } catch (e) {
                                                rej (e);
                                            }
                                        })
                                };
                            } catch (e) {
                                rej (e);
                            }
                        })
                    );
                    [o_stream, i_stream].forEach(s => s.close());
                });
            } catch (e) {
                rej (e);
            }
        }
    });
};

const http_handler = async function (req, res) {
    var u = url.parse(req.url, true);
    if (u.pathname == '/status') {
        try {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(await BGPMonClient(mon_trigger, mon_out)));
        } catch (e) {
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: e}));
        }
        return;
    }

    const m_types = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg'
    };

    if (u.pathname == '/') {
        res.writeHead(302, {'Location': '/app/'});
        res.end();
        return;
    }

    var p = path.normalize(u.pathname.replace(/^\/app/, ''))
        .replace(/^(\.\.[\/\\])+/, '');
    if (p == '/' || p == '.') p = '/index.html';

    var r_path = path.join(__dirname + '/', p);
    fs.exists(r_path, function (e) {
        if (!e) {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.end('Not Found.');
            return;
        } else {
            fs.readFile(r_path, (e, d) => {
                if (e) {
                    res.writeHead(500, {'Content-Type': 'text/plain'});
                    res.end('Read Error.');
                    return;
                }

                res.writeHead(200, {'Content-Type': m_types[path.parse(r_path).ext]});
                res.end(d);
            })
        }
    });
}

var server = http.createServer(http_handler);
server.listen(Number.parseInt(process.argv[3]), process.argv[2], 64, () => {
    console.log(`Visualization server ready at ${process.argv[2]}:${process.argv[3]}.`);
});
