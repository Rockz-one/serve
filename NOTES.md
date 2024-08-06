#### Testing the difference for express compression
Request without accepting deflate
```bash
$ curl http://localhost:8000 --silent --write-out "%{size_download}\n" --output /dev/null

12026
```
Request with accepting gzip
```bash
$ curl http://localhost:8000 --silent -H "Accept-Encoding: gzip,deflate" --write-out "%{size_download}\n" --output /dev/null

1857
```

## Ideas
- [ ] Amertize directory stats
- [ ] Make tests
- [ ] Plot tests

## Look into compression with files
- [https://github.com/expressjs/compression/issues/35](https://github.com/expressjs/compression/issues/35)